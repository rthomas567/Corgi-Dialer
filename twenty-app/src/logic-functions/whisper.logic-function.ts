import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { ROUTE_WHISPER, WHISPER_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { escapeXml, twimlResponse } from 'src/shared/twiml';
import { readFormBody } from 'src/shared/route-body';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { isFromTwilio } from 'src/shared/verify-twilio';

// Plays the recording announcement to the person being called, right after
// they pick up and before they are connected to the rep.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_WHISPER, form)) {
    return new Response('Not from Twilio', { status: 403 });
  }
  const announcement = (process.env.RECORDING_ANNOUNCEMENT ?? '').trim();
  return twimlResponse(announcement ? `<Say>${escapeXml(announcement)}</Say>` : '');
};

export default defineLogicFunction({
  universalIdentifier: WHISPER_FUNCTION_ID,
  name: 'dialer-whisper',
  description: 'Plays the recording announcement to the person being called.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_WHISPER,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
