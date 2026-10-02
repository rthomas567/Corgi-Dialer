import { createHmac, timingSafeEqual } from 'crypto';

// Atlas signs every webhook (asyncapi.json, hmac_signature):
//   signed_payload = "{timestamp}.{raw_body}"
//   signature      = lowercase hex HMAC-SHA256(secret, signed_payload)
//   X-Corgi-Signature: t=<unix_seconds>,v1=<hex>[,v1=<hex> during a secret rotation]
// Rules: verify over the RAW bytes, compare in constant time, reject a timestamp
// more than 5 minutes from our clock, and never verify with an empty secret.

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: 'no-secret' | 'no-signature' | 'malformed' | 'stale' | 'mismatch' };

export const parseSignatureHeader = (header: string) => {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, ...rest] = part.trim().split('=');
    const value = rest.join('=');
    if (key === 't' && /^[0-9]+$/.test(value)) {
      timestamp = Number(value);
    } else if (key === 'v1' && /^[0-9a-f]{64}$/.test(value)) {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
};

export const signAtlasPayload = (secret: string, timestamp: number, rawBody: string) =>
  createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');

const safeEqualHex = (a: string, b: string) => {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

export const verifyAtlasSignature = (input: {
  secret: string;
  header: string | undefined;
  rawBodies: string[]; // the raw body, plus fallbacks if the platform re-encoded it
  nowSeconds?: number;
}): SignatureCheck => {
  const secret = input.secret.trim();
  if (!secret) {
    return { ok: false, reason: 'no-secret' };
  }
  if (!input.header) {
    return { ok: false, reason: 'no-signature' };
  }
  const { timestamp, signatures } = parseSignatureHeader(input.header);
  if (timestamp === null || signatures.length === 0) {
    return { ok: false, reason: 'malformed' };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }
  for (const body of input.rawBodies) {
    const expected = signAtlasPayload(secret, timestamp, body);
    if (signatures.some((candidate) => safeEqualHex(candidate, expected))) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'mismatch' };
};

// Go's JSON encoder (Atlas' docs show \u003c-style escapes) escapes <, > and &.
// If the platform hands us a parsed body instead of the raw bytes, these are the
// most likely original spellings to try.
export const candidateRawBodies = (rawBody: string | undefined, parsed: unknown): string[] => {
  const bodies: string[] = [];
  if (rawBody) {
    bodies.push(rawBody);
  }
  if (parsed && typeof parsed === 'object') {
    const compact = JSON.stringify(parsed);
    bodies.push(compact);
    bodies.push(
      compact.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'),
    );
  }
  return [...new Set(bodies)];
};
