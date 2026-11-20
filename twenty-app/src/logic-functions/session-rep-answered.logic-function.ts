import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_REP_ANSWERED,
  SESSION_REP_ANSWERED_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { readFormBody } from 'src/shared/route-body';
import { repConfirmTwiml, repJoinTwiml } from 'src/shared/session-engine';
import { getSession, saveRepLeg, sessionIdForRepCall } from 'src/shared/session-store';
import { twimlResponse } from 'src/shared/twiml';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { functionsBaseUrl } from 'src/shared/twenty-api';
import { isFromTwilio } from 'src/shared/verify-twilio';

// Twilio asks this when the rep picks up their phone at the start of a
// session. The rep presses 1 to start (so the rep's own voicemail can never
// "answer" and end up talking to prospects), then waits on an open line.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_SESSION_REP_ANSWERED, form)) {
    return new Response('Not from Twilio', { status: 403 });
  }
  const sessionId = form.CallSid ? await sessionIdForRepCall(form.CallSid) : null;
  const session = sessionId ? await getSession(sessionId) : null;
  if (!session || session.state !== 'active') {
    return twimlResponse('<Say>This dialing session has ended.</Say><Hangup/>');
  }
  if (form.Digits !== '1') {
    return twimlResponse(
      repConfirmTwiml(`${functionsBaseUrl()}${ROUTE_SESSION_REP_ANSWERED}`, form.Digits !== undefined),
    );
  }
  await saveRepLeg({ sessionId: session.id, status: 'joined' });
  return twimlResponse(repJoinTwiml(session.id));
};

export default defineLogicFunction({
  universalIdentifier: SESSION_REP_ANSWERED_FUNCTION_ID,
  name: 'dialer-session-rep-answered',
  description: 'Puts the rep on an open line when they answer at the start of a session.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_REP_ANSWERED,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
