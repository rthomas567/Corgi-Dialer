import type { RoutePayload } from 'twenty-sdk/logic-function';

import { isGenuineTwilioRequest } from 'src/shared/twilio-signature';
import { functionsBaseUrl } from 'src/shared/twenty-api';

const rawBodyText = (event: RoutePayload): string | undefined => {
  if (event.rawBody === undefined) {
    return undefined;
  }
  return event.isBase64Encoded
    ? Buffer.from(event.rawBody, 'base64').toString('utf8')
    : event.rawBody;
};

// True when the update should be trusted.
// SignalWire signs updates with the Signing Key. If no Signing Key is set yet,
// every update is accepted (setup/testing mode).
export const isFromTwilio = (
  event: RoutePayload,
  routePath: string,
  formParams: Record<string, string>,
): boolean => {
  const authToken = (process.env.SIGNALWIRE_SIGNING_KEY ?? '').trim();
  if (!authToken) {
    return true;
  }
  return isGenuineTwilioRequest({
    authToken,
    url: `${functionsBaseUrl()}${routePath}`,
    headers: event.headers ?? {},
    formParams,
    rawBody: rawBodyText(event),
  });
};
