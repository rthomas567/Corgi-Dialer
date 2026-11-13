import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  CALL_EVENTS_FUNCTION_ID,
  ROUTE_CALL_EVENTS,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import { twimlResponse } from 'src/shared/twiml';
import { readFormBody } from 'src/shared/route-body';
import { syncCallResult } from 'src/shared/sync-record';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { isFromTwilio } from 'src/shared/verify-twilio';

const FINISHED = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

// SignalWire reports progress here: rep's phone ringing, rep answered,
// prospect ringing, prospect answered, call ended.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_CALL_EVENTS, form)) {
    return new Response('Not from SignalWire', { status: 403 });
  }
  const status = (form.CallStatus || '').toLowerCase();
  const isProspectLeg = Boolean(form.ParentCallSid);
  const parentSid = form.ParentCallSid || form.CallSid;

  const call = parentSid ? await getCall(parentSid) : null;
  if (!call) {
    return twimlResponse('');
  }

  const now = new Date().toISOString();
  const duration = Number(form.CallDuration || form.DialCallDuration || 0);

  if (isProspectLeg) {
    if (status === 'ringing' && call.stage !== 'connected') {
      await updateCall(call.callSid, { stage: 'prospect-ringing' });
    } else if (status === 'in-progress' || status === 'answered') {
      await syncCallResult(await updateCall(call.callSid, { stage: 'connected', connectedAt: now }));
    } else if (FINISHED.has(status) && call.stage !== 'ended') {
      await syncCallResult(
        await updateCall(call.callSid, {
          stage: 'ended',
          endedAt: now,
          endReason: status === 'completed' ? 'completed' : `prospect-${status}`,
          durationSeconds: call.connectedAt ? duration : 0,
        }),
      );
    } else if (FINISHED.has(status) && call.durationSeconds == null) {
      // The rep hung up from the panel first; still record how long they talked.
      await syncCallResult(
        await updateCall(call.callSid, {
          durationSeconds: call.connectedAt ? duration : 0,
        }),
      );
    }
    return twimlResponse('');
  }

  // Rep's leg
  if ((status === 'ringing' || status === 'initiated' || status === 'queued') &&
      call.stage === 'starting') {
    await updateCall(call.callSid, { stage: 'rep-ringing' });
  } else if (FINISHED.has(status) && call.stage !== 'ended') {
    const repNeverAnswered = call.stage === 'starting' || call.stage === 'rep-ringing';
    await syncCallResult(
      await updateCall(call.callSid, {
        stage: 'ended',
        endedAt: now,
        endReason: repNeverAnswered ? `rep-${status}` : 'completed',
      }),
    );
  }

  return twimlResponse('');
};

export default defineLogicFunction({
  universalIdentifier: CALL_EVENTS_FUNCTION_ID,
  name: 'dialer-call-events',
  description: 'Receives call progress updates from SignalWire.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_CALL_EVENTS,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
