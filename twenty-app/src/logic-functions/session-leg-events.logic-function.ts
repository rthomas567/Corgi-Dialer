import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_LEG_EVENTS,
  SESSION_LEG_EVENTS_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import { readFormBody } from 'src/shared/route-body';
import {
  callResultForStatus,
  finalStatusFromTwilio,
  isFinalStatus,
} from 'src/shared/session-engine';
import { getClaim, getLeg, type TargetStatus, updateLeg } from 'src/shared/session-store';
import { syncCallResult } from 'src/shared/sync-record';
import { twimlResponse } from 'src/shared/twiml';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { updateRecord } from 'src/shared/twenty-api';
import { isFromTwilio } from 'src/shared/verify-twilio';

const FINISHED = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

// SignalWire reports on each parallel line here: ringing, answered, ended.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_SESSION_LEG_EVENTS, form)) {
    return new Response('Not from SignalWire', { status: 403 });
  }
  const callSid = form.CallSid;
  const leg = callSid ? await getLeg(callSid) : null;
  if (!leg) {
    return twimlResponse('');
  }
  const status = (form.CallStatus || '').toLowerCase();

  if (status === 'ringing' && leg.status === 'dialing') {
    await updateLeg(leg.callSid, { status: 'ringing' });
    return twimlResponse('');
  }
  if (!FINISHED.has(status)) {
    return twimlResponse('');
  }

  const endedAt = new Date().toISOString();
  const durationSeconds = Number(form.CallDuration || 0);

  // The rep's conversation ended.
  if (leg.status === 'connected') {
    await updateLeg(leg.callSid, { status: 'done', endedAt, durationSeconds });
    const call = await getCall(leg.callSid);
    if (call && call.stage !== 'ended') {
      await syncCallResult(
        await updateCall(leg.callSid, {
          stage: 'ended',
          endedAt,
          endReason: 'completed',
          durationSeconds,
        }),
      );
    }
    return twimlResponse('');
  }

  // Already settled when it was answered (voicemail / dropped).
  if (isFinalStatus(leg.status)) {
    return twimlResponse('');
  }

  // Never reached the rep. A line we hung up ourselves shows as "completed"
  // with nobody on it (canceled); someone who hung up while SignalWire was still
  // listening for a voicemail counts as no answer - unless we hung up on
  // them because another line got the rep, which needs a call back.
  let finalStatus: TargetStatus = finalStatusFromTwilio(status);
  if (finalStatus === 'done') {
    if (durationSeconds > 0) {
      const winner = await getClaim(leg.sessionId, leg.batchNumber);
      finalStatus = winner && winner !== leg.callSid ? 'dropped' : 'no-answer';
    } else {
      finalStatus = 'canceled';
    }
  }
  await updateLeg(leg.callSid, { status: finalStatus, endedAt, durationSeconds: 0 });
  if (leg.recordId) {
    await updateRecord(
      'dialerCalls',
      leg.recordId,
      { callResult: callResultForStatus(finalStatus), durationSeconds: 0 },
      'application',
    ).catch(() => undefined);
  }
  return twimlResponse('');
};

export default defineLogicFunction({
  universalIdentifier: SESSION_LEG_EVENTS_FUNCTION_ID,
  name: 'dialer-session-leg-events',
  description: 'Tracks each line dialed by the power / parallel dialer.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_LEG_EVENTS,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
