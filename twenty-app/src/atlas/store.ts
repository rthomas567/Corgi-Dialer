import { kv } from 'twenty-sdk/logic-function';

// Small bits of memory the sync keeps between Atlas messages.

// 1. Which messages were already handled. Atlas delivers "at least once", so the
//    same message can arrive twice; the envelope id is the dedupe key.
export const wasHandled = async (eventId: string) =>
  (await kv.get<boolean>(`atlas-evt:${eventId}`)) === true;
export const markHandled = (eventId: string) => kv.set(`atlas-evt:${eventId}`, true);

// 2. Which Opportunity each Atlas quote became.
export const oppForQuote = (quoteNumber: string) =>
  kv.get<string>(`atlas-quote-opp:${quoteNumber}`);
export const rememberOppForQuote = (quoteNumber: string, oppId: string) =>
  kv.set(`atlas-quote-opp:${quoteNumber}`, oppId);

// 3. A short claim while an Opportunity is being created, so two messages about
//    the same brand-new quote can't create it twice.
const CLAIM_MS = 60_000;
export const claimQuote = async (quoteNumber: string, eventId: string) => {
  const key = `atlas-quote-claim:${quoteNumber}`;
  const existing = await kv.get<{ by: string; at: number }>(key);
  if (existing && existing.by !== eventId && Date.now() - existing.at < CLAIM_MS) {
    return false;
  }
  await kv.set(key, { by: eventId, at: Date.now() });
  const check = await kv.get<{ by: string; at: number }>(key);
  return check?.by === eventId;
};
export const releaseQuote = (quoteNumber: string) => kv.delete(`atlas-quote-claim:${quoteNumber}`);

// 4. Updates that arrived before the quote's Opportunity existed (for example a
//    price change racing ahead of the first status message). Applied on creation.
export type PendingQuoteUpdate = {
  premium?: string;
  pricingRevision?: number;
  stageStatus?: string;
  submissionNumber?: string;
  facts?: {
    insuredName?: string | null;
    submitterEmail?: string | null;
    submitterName?: string | null;
    agencyName?: string | null;
    coverageSlugs?: string[];
  };
};
export const getPending = (quoteNumber: string) =>
  kv.get<PendingQuoteUpdate>(`atlas-quote-pending:${quoteNumber}`);
export const addPending = async (quoteNumber: string, update: PendingQuoteUpdate) => {
  const current = (await getPending(quoteNumber)) ?? {};
  const merged: PendingQuoteUpdate = {
    ...current,
    ...update,
    facts: { ...(current.facts ?? {}), ...(update.facts ?? {}) },
  };
  // Never let an older price overwrite a newer one.
  if (
    current.pricingRevision !== undefined &&
    update.pricingRevision !== undefined &&
    update.pricingRevision < current.pricingRevision
  ) {
    merged.premium = current.premium;
    merged.pricingRevision = current.pricingRevision;
  }
  await kv.set(`atlas-quote-pending:${quoteNumber}`, merged);
};
export const clearPending = (quoteNumber: string) => kv.delete(`atlas-quote-pending:${quoteNumber}`);

// 5. The last price revision applied per quote ("revision" orders price changes).
export const lastPricingRevision = (quoteNumber: string) =>
  kv.get<number>(`atlas-quote-rev:${quoteNumber}`);
export const setPricingRevision = (quoteNumber: string, revision: number) =>
  kv.set(`atlas-quote-rev:${quoteNumber}`, revision);

// 6. The most recent messages, kept so the mapping can be checked against real data.
const SAMPLE_LIMIT = 10;
export type AtlasSample = { receivedAt: string; type: string; environment: string; body: unknown };
export const keepSample = async (sample: AtlasSample) => {
  const samples = (await kv.get<AtlasSample[]>('atlas-samples')) ?? [];
  await kv.set('atlas-samples', [sample, ...samples].slice(0, SAMPLE_LIMIT));
};
export const getSamples = async () => (await kv.get<AtlasSample[]>('atlas-samples')) ?? [];
