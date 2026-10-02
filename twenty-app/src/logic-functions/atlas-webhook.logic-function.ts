import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { candidateRawBodies, verifyAtlasSignature } from 'src/atlas/signature';
import { keepSample, markHandled, wasHandled } from 'src/atlas/store';
import { type AtlasEnvelope, handleAtlasEvent, RetryLater } from 'src/atlas/sync';
import {
  ATLAS_WEBHOOK_FUNCTION_ID,
  ROUTE_ATLAS_WEBHOOK,
} from 'src/constants/universal-identifiers';

const ATLAS_HEADERS = [
  'x-corgi-signature',
  'x-corgi-event',
  'x-corgi-event-id',
  'x-corgi-environment',
  'x-corgi-timestamp',
  'x-corgi-delivery',
];

const header = (event: RoutePayload, name: string) => {
  const headers = event.headers ?? {};
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? headers[key] : undefined;
};

const rawText = (event: RoutePayload) => {
  if (event.rawBody === undefined) return undefined;
  return event.isBase64Encoded ? Buffer.from(event.rawBody, 'base64').toString('utf8') : event.rawBody;
};

const parseEnvelope = (event: RoutePayload, raw: string | undefined): AtlasEnvelope | null => {
  try {
    const body = event.body && typeof event.body === 'object' ? event.body : raw ? JSON.parse(raw) : null;
    if (!body || typeof body.id !== 'string' || typeof body.type !== 'string') return null;
    return body as AtlasEnvelope;
  } catch {
    return null;
  }
};

// Which plane a message is from. Atlas: "treat a missing environment as unknown
// rather than live, and read live_mode". Nearly every business message carries
// live_mode; one carrying neither is treated as live.
export const messagePlane = (envelope: AtlasEnvelope, headerValue: string | undefined) => {
  const stamped = (headerValue ?? envelope.environment ?? '').toLowerCase();
  if (stamped === 'live' || stamped === 'test') return stamped;
  const liveMode = envelope.data?.live_mode;
  if (liveMode === false) return 'test';
  return 'live';
};

// Atlas delivers every webhook here. Responding 2xx ends the delivery; anything
// else makes Atlas retry (up to 8 times over ~2 hours).
const handler = async (event: RoutePayload) => {
  const raw = rawText(event);
  const signature = verifyAtlasSignature({
    secret: process.env.ATLAS_WEBHOOK_SECRET ?? '',
    header: header(event, 'x-corgi-signature'),
    rawBodies: candidateRawBodies(raw, event.body),
  });
  if (!signature.ok) {
    return new Response({ ok: false, error: `signature ${signature.reason}` }, { status: 401 });
  }

  const envelope = parseEnvelope(event, raw);
  if (!envelope) {
    return new Response({ ok: false, error: 'not an Atlas message' }, { status: 400 });
  }

  const plane = messagePlane(envelope, header(event, 'x-corgi-environment'));
  const wanted = (process.env.ATLAS_ENVIRONMENT ?? 'live').trim().toLowerCase() === 'test' ? 'test' : 'live';
  if (plane !== wanted && envelope.type !== 'ping') {
    return { ok: true, skipped: `${plane} message (this app processes ${wanted})` };
  }

  if (await wasHandled(envelope.id)) {
    return { ok: true, duplicate: true };
  }

  await keepSample({
    receivedAt: new Date().toISOString(),
    type: envelope.type,
    environment: plane,
    body: envelope,
  });

  try {
    const result = await handleAtlasEvent(envelope);
    await markHandled(envelope.id);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof RetryLater) {
      return new Response({ ok: false, retry: error.message }, { status: 409 });
    }
    return new Response(
      { ok: false, error: error instanceof Error ? error.message : 'sync failed' },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: ATLAS_WEBHOOK_FUNCTION_ID,
  name: 'atlas-webhook',
  description: 'Receives Atlas webhooks and keeps Opportunities in sync (replaces Broker Submissions).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_ATLAS_WEBHOOK,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ATLAS_HEADERS,
  },
});
