import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  ROUTE_RECORDING_READY,
  ROUTE_SESSION_LEG_ANSWERED,
  SESSION_LEG_ANSWERED_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { saveCall, setRepLatestCall } from 'src/shared/call-store';
import { readFormBody } from 'src/shared/route-body';
import {
  callResultForStatus,
  hangUpOpenLegs,
  isMachineAnswer,
  prospectJoinTwiml,
} from 'src/shared/session-engine';
import {
  claimConnection,
  getLeg,
  getRepLeg,
  getSession,
  type Leg,
  type TargetStatus,
  updateLeg,
} from 'src/shared/session-store';
import { readTwilioSettings } from 'src/shared/settings';
import { startRecording } from 'src/shared/twilio';
import { twimlResponse } from 'src/shared/twiml';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { functionsBaseUrl, updateRecord } from 'src/shared/twenty-api';
import { isFromTwilio } from 'src/shared/verify-twilio';

const HANG_UP = '<Hangup/>';

const logResult = async (leg: Leg, status: TargetStatus, extra: Record<string, unknown> = {}) => {
  if (!leg.recordId) return;
  await updateRecord(
    'dialerCalls',
    leg.recordId,
    { callResult: callResultForStatus(status), ...extra },
    'application',
  ).catch(() => undefined);
};

// SignalWire asks this the moment someone picks up one of the parallel lines,
// after it has listened long enough to tell a person from a voicemail.
//  - Voicemail / fax: hang up and log it. The rep never hears it.
//  - A person, and the rep is free: connect them to the rep.
//  - A person, but someone else on another line already got the rep:
//    hang up (no message) and flag it so the rep can call them back.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_SESSION_LEG_ANSWERED, form)) {
    return new Response('Not from SignalWire', { status: 403 });
  }

  const callSid = form.CallSid;
  const leg = callSid ? await getLeg(callSid) : null;
  if (!leg) {
    return twimlResponse(HANG_UP);
  }
  const answeredBy = form.AnsweredBy || 'unknown';

  if (isMachineAnswer(answeredBy)) {
    await updateLeg(leg.callSid, { status: 'voicemail', answeredBy });
    await logResult(leg, 'voicemail', { outcome: 'VOICEMAIL' });
    return twimlResponse(HANG_UP);
  }

  const session = await getSession(leg.sessionId);
  const repLeg = session ? await getRepLeg(session.id) : null;
  const repIsWaiting = session?.state === 'active' && repLeg?.status === 'joined';

  const won =
    repIsWaiting && (await claimConnection(leg.sessionId, leg.batchNumber, leg.callSid));

  if (!session || !won) {
    await updateLeg(leg.callSid, { status: 'dropped', answeredBy });
    await logResult(leg, 'dropped');
    return twimlResponse(HANG_UP);
  }

  // Connected. Stop the other lines from ringing so nobody else picks up.
  const connectedAt = new Date().toISOString();
  await updateLeg(leg.callSid, { status: 'connected', answeredBy, connectedAt });

  await saveCall({
    callSid: leg.callSid,
    workspaceMemberId: session.workspaceMemberId,
    personId: leg.personId,
    companyId: leg.companyId,
    queueItemId: leg.queueItemId,
    displayName:
      leg.companyName && leg.companyName !== leg.name ? `${leg.name} (${leg.companyName})` : leg.name,
    sessionId: session.id,
    prospectNumber: leg.number,
    callerId: session.callerId,
    stage: 'connected',
    connectedAt,
    repAnswered: true,
    repName: session.repName,
    loggedRecordId: leg.recordId,
    createdAt: connectedAt,
  });
  await setRepLatestCall(session.workspaceMemberId, leg.callSid);

  const twilio = readTwilioSettings();
  if (twilio) {
    const others = await Promise.all(
      (session.batch?.legSids ?? []).filter((sid) => sid !== leg.callSid).map((sid) => getLeg(sid)),
    );
    await Promise.allSettled([
      hangUpOpenLegs(twilio, others.filter((other): other is Leg => Boolean(other)), leg.callSid),
      startRecording(twilio, leg.callSid, `${functionsBaseUrl()}${ROUTE_RECORDING_READY}`),
    ]);
  }
  await logResult(leg, 'connected');

  const announcement = (process.env.RECORDING_ANNOUNCEMENT ?? '').trim();
  return twimlResponse(prospectJoinTwiml(session.id, announcement));
};

export default defineLogicFunction({
  universalIdentifier: SESSION_LEG_ANSWERED_FUNCTION_ID,
  name: 'dialer-session-leg-answered',
  description: 'Connects the first person who picks up to the rep; skips voicemails.',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_LEG_ANSWERED,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
