import type { RoutePayload } from 'twenty-sdk/logic-function';

import { isGenuineSignalWireRequest } from 'src/shared/signalwire-signature';
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
// If no Signing Key is set yet, every update is accepted (setup/testing mode).
export const isFromSignalWire = (
  event: RoutePayload,
  routePath: string,
  formParams: Record<string, string>,
): boolean => {
  const signingKey = (process.env.SIGNALWIRE_SIGNING_KEY ?? '').trim();
  if (!signingKey) {
    return true;
  }
  return isGenuineSignalWireRequest({
    signingKey,
    url: `${functionsBaseUrl()}${routePath}`,
    headers: event.headers ?? {},
    formParams,
    rawBody: rawBodyText(event),
  });
};
