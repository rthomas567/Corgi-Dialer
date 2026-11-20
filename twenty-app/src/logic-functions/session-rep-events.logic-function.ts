import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_REP_EVENTS,
  SESSION_REP_EVENTS_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { readFormBody } from 'src/shared/route-body';
import { getRepLeg, saveRepLeg, sessionIdForRepCall } from 'src/shared/session-store';
import { twimlResponse } from 'src/shared/twiml';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { isFromTwilio } from 'src/shared/verify-twilio';

const FINISHED = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

// Twilio reports on the rep's own phone line here. When it ends, the
// session ends (the next status check hangs up anything still ringing).
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_SESSION_REP_EVENTS, form)) {
    return new Response('Not from Twilio', { status: 403 });
  }
  const status = (form.CallStatus || '').toLowerCase();
  const sessionId = form.CallSid ? await sessionIdForRepCall(form.CallSid) : null;
  if (!sessionId || !FINISHED.has(status)) {
    return twimlResponse('');
  }
  const current = await getRepLeg(sessionId);
  const neverJoined = current?.status !== 'joined';
  await saveRepLeg({
    sessionId,
    status: 'ended',
    endReason: neverJoined ? `rep-${status}` : 'rep-hung-up',
  });
  return twimlResponse('');
};

export default defineLogicFunction({
  universalIdentifier: SESSION_REP_EVENTS_FUNCTION_ID,
  name: 'dialer-session-rep-events',
  description: "Tracks the rep's own phone line during a dialing session.",
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_REP_EVENTS,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
