import { createHmac, timingSafeEqual } from 'crypto';

// SignalWire signs every update it sends with your project's Signing Key
// (SignalWire dashboard > API Credentials > Signing Key). Checking it proves
// the update really came from SignalWire.
//
// Form updates (what calls use) are signed like this:
//   base64( HMAC-SHA1( signingKey, fullUrl + each field name and value, sorted by name ) )
// JSON updates are signed as:
//   hex( HMAC-SHA1( signingKey, fullUrl + rawBody ) )

const safeEqual = (a: string, b: string) => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

// SignalWire may sign the address with or without the default ":443" port.
const urlVariants = (url: string): string[] => {
  const variants = new Set([url]);
  try {
    const parsed = new URL(url);
    if (parsed.port === '') {
      const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
      variants.add(url.replace(parsed.host, `${parsed.hostname}:${defaultPort}`));
    } else if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      variants.add(url.replace(`:${parsed.port}`, ''));
    }
  } catch {
    // Not a full URL; just use it as given.
  }
  return [...variants];
};

export const signFormRequest = (
  signingKey: string,
  url: string,
  params: Record<string, string>,
) => {
  const data = Object.keys(params)
    .sort()
    .reduce((text, key) => text + key + params[key], url);
  return createHmac('sha1', signingKey).update(data, 'utf8').digest('base64');
};

export const signJsonRequest = (signingKey: string, url: string, rawBody: string) =>
  createHmac('sha1', signingKey).update(url + rawBody, 'utf8').digest('hex');

const readHeader = (headers: Record<string, string | undefined>, name: string) => {
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name);
  return match ? headers[match] : undefined;
};

export const SIGNATURE_HEADERS = ['x-signalwire-signature', 'x-twilio-signature'];

export const isGenuineSignalWireRequest = (input: {
  signingKey: string;
  url: string;
  headers: Record<string, string | undefined>;
  formParams: Record<string, string>;
  rawBody?: string;
}): boolean => {
  const signature =
    readHeader(input.headers, 'x-signalwire-signature') ??
    readHeader(input.headers, 'x-twilio-signature');
  if (!signature) {
    return false;
  }

  for (const url of urlVariants(input.url)) {
    if (safeEqual(signFormRequest(input.signingKey, url, input.formParams), signature)) {
      return true;
    }
    if (
      input.rawBody !== undefined &&
      safeEqual(signJsonRequest(input.signingKey, url, input.rawBody), signature)
    ) {
      return true;
    }
  }
  return false;
};
