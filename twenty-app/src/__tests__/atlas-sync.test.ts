import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Fakes: Twenty's key-value storage, Twenty records, and Atlas lookups ----
const memory = new Map<string, unknown>();
vi.mock('twenty-sdk/logic-function', async () => {
  const actual = await vi.importActual<any>('twenty-sdk/logic-function');
  return {
    ...actual,
    kv: {
      get: async (key: string) => (memory.has(key) ? structuredClone(memory.get(key)) : null),
      set: async (key: string, value: unknown) => void memory.set(key, structuredClone(value)),
      delete: async (key: string) => memory.delete(key),
    },
  };
});

const opps = new Map<string, any>();
const companies: any[] = [];
const people: any[] = [];
let nextId = 1;
vi.mock('src/atlas/records', () => ({
  getOpportunity: async (id: string) => (opps.has(id) ? { ...opps.get(id) } : null),
  findOpportunityByQuote: async (quote: string) =>
    [...opps.values()].find((o) => (o.atlasQuoteNumbers ?? '').split(',').includes(quote)) ?? null,
  createOpportunity: async (data: any) => {
    const record = { id: `opp-${nextId++}`, ...data };
    opps.set(record.id, record);
    return { ...record };
  },
  updateOpportunity: async (id: string, data: any) => {
    opps.set(id, { ...opps.get(id), ...data });
    return { ...opps.get(id) };
  },
  findPersonByEmail: async (email: string) =>
    people.find((p) => p.emails.primaryEmail.toLowerCase() === email.toLowerCase()) ?? null,
  findCompanyByDomain: async (domain: string) =>
    companies.find((c) => (c.domainName?.primaryLinkUrl ?? '').includes(domain)) ?? null,
  findCompanyByName: async (name: string) =>
    companies.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null,
  createCompany: async (data: any) => {
    const record = { id: `co-${nextId++}`, ...data };
    companies.push(record);
    return record;
  },
  createPerson: async (data: any) => {
    const record = { id: `p-${nextId++}`, ...data };
    people.push(record);
    return record;
  },
}));

let atlasQuote: any = null;
vi.mock('src/atlas/atlas-api', () => ({ fetchAtlasQuote: async () => atlasQuote }));

import { readSubmissionDetail } from 'src/atlas/detail';
import { coveragesForSlugs, nextStage, premiumToAmount, stageForAtlasStatus } from 'src/atlas/mapping';
import { candidateRawBodies, signAtlasPayload, verifyAtlasSignature } from 'src/atlas/signature';
import { claimQuote } from 'src/atlas/store';
import webhook from 'src/logic-functions/atlas-webhook.logic-function';

const SECRET = 'whsec_test_secret';
const run = webhook.config.handler as (event: any) => Promise<any>;
let eventCounter = 0;

const deliver = async (type: string, data: Record<string, unknown>, opts: { id?: string; env?: string; secret?: string; createdAt?: string } = {}) => {
  const body = { id: opts.id ?? `evt_${String(++eventCounter).padStart(26, '0')}`, type, created_at: opts.createdAt ?? '2026-10-02T20:00:00Z', data };
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v1 = signAtlasPayload(opts.secret ?? SECRET, t, raw);
  const result = await run({
    headers: { 'X-Corgi-Signature': `t=${t},v1=${v1}`, 'X-Corgi-Event': type, ...(opts.env ? { 'X-Corgi-Environment': opts.env } : {}) },
    queryStringParameters: {},
    pathParameters: {},
    body,
    rawBody: raw,
    isBase64Encoded: false,
    requestContext: { http: { method: 'POST', path: '/atlas/webhook' } },
    userWorkspaceId: null,
  });
  return result;
};
const statusOf = (result: any) => (result && result.__twentyHttpResponse ? result.status : 200);
const onlyOpp = () => [...opps.values()][0];

beforeEach(() => {
  memory.clear();
  opps.clear();
  companies.length = 0;
  people.length = 0;
  atlasQuote = null;
  process.env.ATLAS_WEBHOOK_SECRET = SECRET;
  delete process.env.ATLAS_ENVIRONMENT;
});

describe('signature check (Atlas rules)', () => {
  const raw = '{"id":"evt_1","type":"ping","data":{}}';
  const now = 1_790_000_000;
  const header = (secret: string, t = now, body = raw) => `t=${t},v1=${signAtlasPayload(secret, t, body)}`;

  it('accepts a correct signature', () => {
    expect(verifyAtlasSignature({ secret: SECRET, header: header(SECRET), rawBodies: [raw], nowSeconds: now }).ok).toBe(true);
  });
  it('matches a hand-computed HMAC-SHA256 over "t.body"', () => {
    const expected = createHmac('sha256', SECRET).update(`${now}.${raw}`).digest('hex');
    expect(signAtlasPayload(SECRET, now, raw)).toBe(expected);
  });
  it('rejects tampering, wrong secrets, stale timestamps and an empty secret', () => {
    expect(verifyAtlasSignature({ secret: SECRET, header: header(SECRET), rawBodies: [raw + ' '], nowSeconds: now })).toMatchObject({ ok: false, reason: 'mismatch' });
    expect(verifyAtlasSignature({ secret: SECRET, header: header('other'), rawBodies: [raw], nowSeconds: now }).ok).toBe(false);
    expect(verifyAtlasSignature({ secret: SECRET, header: header(SECRET, now - 301), rawBodies: [raw], nowSeconds: now })).toMatchObject({ reason: 'stale' });
    expect(verifyAtlasSignature({ secret: '  ', header: header(''), rawBodies: [raw], nowSeconds: now })).toMatchObject({ reason: 'no-secret' });
    expect(verifyAtlasSignature({ secret: SECRET, header: undefined, rawBodies: [raw], nowSeconds: now })).toMatchObject({ reason: 'no-signature' });
  });
  it('accepts any of several signatures during a secret rotation', () => {
    const both = `t=${now},v1=${signAtlasPayload('old', now, raw)},v1=${signAtlasPayload(SECRET, now, raw)}`;
    expect(verifyAtlasSignature({ secret: SECRET, header: both, rawBodies: [raw], nowSeconds: now }).ok).toBe(true);
  });
  it('can verify a Go-style escaped body when only the parsed body is available', () => {
    const parsed = { id: 'evt_2', type: 'ping', data: { message: '<test> & more' } };
    const goRaw = JSON.stringify(parsed).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    expect(verifyAtlasSignature({ secret: SECRET, header: header(SECRET, now, goRaw), rawBodies: candidateRawBodies(undefined, parsed), nowSeconds: now }).ok).toBe(true);
  });
});

describe('mapping rules', () => {
  it('maps Atlas statuses to stages', () => {
    expect(stageForAtlasStatus('submitted')).toBe('SUBMISSION_RECEIVED');
    expect(stageForAtlasStatus('needs_review')).toBe('IN_REVIEW');
    expect(stageForAtlasStatus('referred')).toBe('IN_REVIEW');
    expect(stageForAtlasStatus('quoted')).toBe('QUOTE_SENT');
    expect(stageForAtlasStatus('purchased')).toBe('BOUND');
    expect(stageForAtlasStatus('declined')).toBe('CLOSED_LOST');
    expect(stageForAtlasStatus('something_new')).toBeNull();
  });
  it('only moves stages forward', () => {
    expect(nextStage('QUOTE_SENT', 'IN_REVIEW')).toBeNull();
    expect(nextStage('NEGOTIATING', 'QUOTE_SENT')).toBeNull(); // a rep's manual stage survives
    expect(nextStage('IN_REVIEW', 'QUOTE_SENT')).toBe('QUOTE_SENT');
    expect(nextStage('BOUND', 'CLOSED_LOST')).toBeNull();
    expect(nextStage('QUOTE_SENT', 'CLOSED_LOST')).toBe('CLOSED_LOST');
    expect(nextStage('CLOSED_LOST', 'QUOTE_SENT')).toBe('QUOTE_SENT');
  });
  it('maps coverage slugs and premiums', () => {
    expect(coveragesForSlugs(['general_liability', 'cyber', 'commercial-property', 'umbrella', 'mystery_line'])).toEqual(['GL', 'CYBER', 'COMMERCIAL_PROPERTY', 'UMBRELLA']);
    expect(premiumToAmount('1130.55')).toEqual({ amountMicros: 1_130_550_000, currencyCode: 'USD' });
    expect(premiumToAmount('abc')).toBeNull();
  });
  it('reads a plausible submission detail block', () => {
    const facts = readSubmissionDetail({
      applicant: { legal_name: 'Central and Plaine LLC', address: { city: 'Chicago' } },
      submitter: { name: 'Justin Lee', email: 'justin@235insurance.com', organization: { name: '235 Insurance' } },
      coverages: [{ coverage_slug: 'general_liability', status: 'quoted', quote: { quote_number: '4IIXAAO9' } }],
    });
    expect(facts).toMatchObject({
      insuredName: 'Central and Plaine LLC',
      submitterEmail: 'justin@235insurance.com',
      submitterName: 'Justin Lee',
      agencyName: '235 Insurance',
      quoteNumbers: ['4IIXAAO9'],
      coverageSlugs: ['general_liability'],
    });
  });
});

describe('Atlas webhook -> Opportunities', () => {
  it('refuses unsigned or wrongly signed messages, and refuses everything with no secret set', async () => {
    expect(statusOf(await deliver('ping', {}, { secret: 'wrong' }))).toBe(401);
    delete process.env.ATLAS_WEBHOOK_SECRET;
    expect(statusOf(await deliver('ping', {}))).toBe(401);
  });

  it('creates one Opportunity for a new quote, in the broker pipeline, linked to Atlas', async () => {
    atlasQuote = { insured_name: 'TM3N, LLC', premium: '2736.73', coverage_slugs: ['general_liability'] };
    const result = await deliver('quote.status_changed', { quote_id: 'q1', quote_number: 'ZET5JU4X', to_status: 'quoted', live_mode: true });
    expect(result).toMatchObject({ ok: true, action: 'quote-status' });
    expect(opps.size).toBe(1);
    expect(onlyOpp()).toMatchObject({
      name: 'TM3N, LLC',
      stage: 'QUOTE_SENT',
      pipeline: 'PARTNER',
      leadSource: 'BROKER',
      insuredName: 'TM3N, LLC',
      atlasQuoteNumbers: 'ZET5JU4X',
      atlasQuoteLink: { primaryLinkUrl: 'https://v2.atlas.corgi.insure/quotes/ZET5JU4X' },
      amount: { amountMicros: 2_736_730_000, currencyCode: 'USD' },
      coveragesRequested: ['GL'],
    });
  });

  it('ignores a repeated delivery of the same message', async () => {
    await deliver('quote.status_changed', { quote_number: 'AAA11111', to_status: 'draft' }, { id: 'evt_same' });
    const again = await deliver('quote.status_changed', { quote_number: 'AAA11111', to_status: 'draft' }, { id: 'evt_same' });
    expect(again).toMatchObject({ duplicate: true });
    expect(opps.size).toBe(1);
  });

  it('applies a price that arrived before the quote existed, and ignores older prices', async () => {
    await deliver('quote.pricing_changed', { quote_id: 'q', quote_number: 'BBB22222', premium: '900.00', revision: 2, previous_revision: 1, status: 'quoted' });
    expect(opps.size).toBe(0);
    await deliver('quote.status_changed', { quote_number: 'BBB22222', to_status: 'quoted' });
    expect(onlyOpp().amount.amountMicros).toBe(900_000_000);
    await deliver('quote.pricing_changed', { quote_id: 'q', quote_number: 'BBB22222', premium: '100.00', revision: 1, previous_revision: 0, status: 'quoted' });
    expect(onlyOpp().amount.amountMicros).toBe(900_000_000);
    await deliver('quote.pricing_changed', { quote_id: 'q', quote_number: 'BBB22222', premium: '950.50', revision: 3, previous_revision: 2, status: 'quoted' });
    expect(onlyOpp().amount.amountMicros).toBe(950_500_000);
  });

  it('fills insured, agency and producer from the submission details, without duplicating companies or people', async () => {
    await deliver('quote.status_changed', { quote_number: 'CCC33333', to_status: 'submitted' });
    expect(onlyOpp().name).toBe('Atlas quote CCC33333');
    const detail = {
      applicant: { legal_name: 'Grace and Truth Church' },
      submitter: { name: 'Jane Walters', email: 'jwalters@petragroup.org', organization: { name: 'Petra Insurance Agency' } },
      coverages: [{ coverage_slug: 'general_liability', quote: { quote_number: 'CCC33333' } }],
    };
    await deliver('submission.status_changed', { submission_id: 's1', submission_number: 'SUB-100', to_status: 'review', data_version: 2, detail });
    const opp = onlyOpp();
    expect(opp).toMatchObject({ name: 'Grace and Truth Church - Petra Insurance Agency', insuredName: 'Grace and Truth Church', atlasSubmissionNumber: 'SUB-100' });
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({ name: 'Petra Insurance Agency', domainName: { primaryLinkUrl: 'https://petragroup.org' } });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ name: { firstName: 'Jane', lastName: 'Walters' }, companyId: companies[0].id });
    expect(opp.companyId).toBe(companies[0].id);
    expect(opp.producerId).toBe(people[0].id);

    // A second quote from the same agency reuses the same company and person.
    await deliver('quote.status_changed', { quote_number: 'DDD44444', to_status: 'submitted' });
    await deliver('submission.status_changed', { submission_number: 'SUB-101', to_status: 'review', data_version: 2, detail: { ...detail, coverages: [{ quote: { quote_number: 'DDD44444' } }] } });
    expect(companies).toHaveLength(1);
    expect(people).toHaveLength(1);
  });

  it('moves stages forward only, keeps a manual Negotiating stage, and marks bound on policy issued', async () => {
    await deliver('quote.status_changed', { quote_number: 'EEE55555', to_status: 'quoted' });
    const id = onlyOpp().id;
    opps.set(id, { ...opps.get(id), stage: 'NEGOTIATING' }); // a rep moved it by hand
    await deliver('submission.coverage_changed', { submission_id: 's', submission_number: 'SUB-9', coverage_id: 'c', coverage_slug: 'cyber', to_status: 'quoted', data_version: 1, quote_number: 'EEE55555' });
    expect(onlyOpp()).toMatchObject({ stage: 'NEGOTIATING', atlasSubmissionNumber: 'SUB-9' });
    await deliver('policy.issued', { policy_id: 'p', policy_number: 'POL-1', coverage_slug: 'cyber', effective_date: '2026-10-05', quote_number: 'EEE55555' }, { createdAt: '2026-10-03T15:00:00Z' });
    expect(onlyOpp()).toMatchObject({ stage: 'BOUND', boundDate: '2026-10-03' });
    await deliver('quote.status_changed', { quote_number: 'EEE55555', to_status: 'declined' });
    expect(onlyOpp().stage).toBe('BOUND');
  });

  it('skips sandbox messages unless the app is set to test', async () => {
    const skipped = await deliver('quote.status_changed', { quote_number: 'TST00001', to_status: 'draft', live_mode: false });
    expect(skipped.skipped).toContain('test');
    expect(opps.size).toBe(0);
    process.env.ATLAS_ENVIRONMENT = 'test';
    await deliver('quote.status_changed', { quote_number: 'TST00001', to_status: 'draft' }, { env: 'test' });
    expect(opps.size).toBe(1);
  });

  it('asks Atlas to retry if the same new quote is mid-creation', async () => {
    expect(await claimQuote('FFF66666', 'evt_other')).toBe(true);
    const result = await deliver('quote.status_changed', { quote_number: 'FFF66666', to_status: 'draft' });
    expect(statusOf(result)).toBe(409);
    expect(opps.size).toBe(0);
  });

  it('keeps recent messages as samples', async () => {
    await deliver('ping', { subscription_id: 'sub_1', message: 'hello' });
    const samples = memory.get('atlas-samples') as any[];
    expect(samples[0]).toMatchObject({ type: 'ping' });
  });
});
