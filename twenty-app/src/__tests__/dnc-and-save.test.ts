import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fake Twenty and the call store so we can test the decisions, not the network.
const records: Record<string, Record<string, any>> = {};
const lists: Record<string, any[]> = {};
const updates: Array<{ object: string; id: string; data: Record<string, unknown> }> = [];
const creates: Array<{ object: string; data: Record<string, unknown> }> = [];
let failCompanyUpdates = false;

vi.mock('src/shared/twenty-api', () => ({
  functionsBaseUrl: () => 'https://corgi-smb.withtwenty.com',
  getRecord: async (object: string, id: string) => records[`${object}:${id}`] ?? null,
  listRecords: async (object: string) => lists[object] ?? [],
  createRecord: async (object: string, data: Record<string, unknown>) => {
    creates.push({ object, data });
    return { id: 'new-call-record' };
  },
  updateRecord: async (object: string, id: string, data: Record<string, unknown>) => {
    if (object === 'companies' && failCompanyUpdates) {
      throw new Error('nope');
    }
    updates.push({ object, id, data });
    return { id };
  },
}));

const storedCalls: Record<string, any> = {};
const latestCallByRep: Record<string, string> = {};
vi.mock('src/shared/call-store', async () => {
  const actual = await vi.importActual<typeof import('src/shared/call-store')>('src/shared/call-store');
  return {
    getCall: async (sid: string) => storedCalls[sid] ?? null,
    updateCall: async (sid: string, changes: Record<string, unknown>) => {
      storedCalls[sid] = { ...storedCalls[sid], ...changes };
      return storedCalls[sid];
    },
    saveCall: async (call: any) => {
      storedCalls[call.callSid] = call;
    },
    setRepLatestCall: async (memberId: string, sid: string) => {
      latestCallByRep[memberId] = sid;
    },
    getRepLatestCall: async (memberId: string) =>
      latestCallByRep[memberId] ? storedCalls[latestCallByRep[memberId]] ?? null : null,
    isCallActive: actual.isCallActive,
    callNeedsOutcome: actual.callNeedsOutcome,
  };
});

const dialed: string[] = [];
vi.mock('src/shared/twilio', () => ({
  ringRepPhone: async (_settings: unknown, input: { repPhone: string }) => {
    dialed.push(input.repPhone);
    return 'CA-new';
  },
  endCall: async () => undefined,
}));

import { getDoNotCallStatus, isCalendarDate, isCompanyDoNotCall } from 'src/shared/dnc';
import startCall from 'src/logic-functions/start-call.logic-function';
import bridge from 'src/logic-functions/bridge.logic-function';
import myCall from 'src/logic-functions/my-call.logic-function';
import { callNeedsOutcome, isCallActive } from 'src/shared/call-store';
import saveOutcome from 'src/logic-functions/save-outcome.logic-function';

const handler = saveOutcome.config.handler as (event: any, context: any) => Promise<any>;
const context = { workspaceMemberId: 'rep-1', workspaceId: 'w', userWorkspaceId: 'u', retryCount: 0, maxRetries: 0 };
const eventWith = (body: Record<string, unknown>) => ({
  headers: {}, queryStringParameters: {}, pathParameters: {}, body, isBase64Encoded: false,
  requestContext: { http: { method: 'POST', path: '/dialer/save-outcome' } }, userWorkspaceId: 'u',
});

beforeEach(() => {
  for (const key of Object.keys(records)) delete records[key];
  for (const key of Object.keys(lists)) delete lists[key];
  for (const key of Object.keys(storedCalls)) delete storedCalls[key];
  for (const key of Object.keys(latestCallByRep)) delete latestCallByRep[key];
  updates.length = 0;
  creates.length = 0;
  failCompanyUpdates = false;
  records['people:p1'] = { id: 'p1', name: { firstName: 'Jane', lastName: 'Doe' }, companyId: 'c1' };
  records['companies:c1'] = { id: 'c1', name: 'Acme Realty', dnc: false, leadStatus: null, lastContacted: '2026-09-01' };
  storedCalls.CA1 = {
    callSid: 'CA1', workspaceMemberId: 'rep-1', personId: 'p1', prospectNumber: '+15551234567',
    callerId: '+15550000000', stage: 'ended', durationSeconds: 42, createdAt: '2026-09-24T18:00:00.000Z',
  };
});

describe('Do Not Call rules', () => {
  it('treats the DNC switch or a DNC lead status as Do Not Call', () => {
    expect(isCompanyDoNotCall({ id: 'c', dnc: true })).toBe(true);
    expect(isCompanyDoNotCall({ id: 'c', leadStatus: 'DNC' })).toBe(true);
    expect(isCompanyDoNotCall({ id: 'c', dnc: false, leadStatus: 'DISQUALIFIED' })).toBe(false);
    expect(isCompanyDoNotCall(null)).toBe(false);
  });

  it('blocks everyone at a DNC company', async () => {
    records['companies:c1'].leadStatus = 'DNC';
    const status = await getDoNotCallStatus('p1');
    expect(status.doNotCall).toBe(true);
    expect(status.scope).toBe('company');
    expect(status.reason).toContain('Acme Realty');
  });

  it('blocks a second person at the same DNC company too', async () => {
    records['companies:c1'].dnc = true;
    records['people:p9'] = { id: 'p9', companyId: 'c1' };
    expect(await getDoNotCallStatus('p9')).toMatchObject({ doNotCall: true, scope: 'company' });
  });

  it('blocks a person with no company after a DNC call', async () => {
    records['people:p2'] = { id: 'p2', companyId: null };
    lists.dialerCalls = [{ id: 'x', outcome: 'VOICEMAIL' }, { id: 'y', outcome: 'DNC' }];
    expect(await getDoNotCallStatus('p2')).toMatchObject({ doNotCall: true, scope: 'person' });
  });

  it('allows calling otherwise', async () => {
    lists.dialerCalls = [{ id: 'x', outcome: 'VOICEMAIL' }];
    expect((await getDoNotCallStatus('p1')).doNotCall).toBe(false);
  });

  it('only accepts real calendar dates', () => {
    expect(isCalendarDate('2026-09-24')).toBe(true);
    expect(isCalendarDate('Sept 24')).toBe(false);
  });
});

describe('saving a call', () => {
  it('saves the call and moves Last Contacted forward', async () => {
    const result = await handler(eventWith({ callSid: 'CA1', outcome: 'VOICEMAIL', notes: 'left msg', localDate: '2026-09-24' }), context);
    expect(result.ok).toBe(true);
    expect(creates[0].data).toMatchObject({ outcome: 'VOICEMAIL', personId: 'p1', companyId: 'c1', durationSeconds: 42 });
    expect(updates).toEqual([{ object: 'companies', id: 'c1', data: { lastContacted: '2026-09-24' } }]);
  });

  it('never moves Last Contacted backwards', async () => {
    records['companies:c1'].lastContacted = '2026-09-30';
    await handler(eventWith({ callSid: 'CA1', outcome: 'BUSY', localDate: '2026-09-24' }), context);
    expect(updates).toEqual([]);
  });

  it('DNC flags the person, turns on the company switch, and sets Lead Status to DNC', async () => {
    const result = await handler(eventWith({ callSid: 'CA1', outcome: 'DNC', localDate: '2026-09-24' }), context);
    expect(result).toMatchObject({ ok: true, companyMarkedDnc: true, warning: null });
    expect(updates).toEqual([
      { object: 'people', id: 'p1', data: { doNotCall: true } },
      { object: 'companies', id: 'c1', data: { lastContacted: '2026-09-24', dnc: true } },
      { object: 'companies', id: 'c1', data: { leadStatus: 'DNC' } },
    ]);
  });

  it('still reports the call as saved if the company update fails, with a clear warning', async () => {
    failCompanyUpdates = true;
    const result = await handler(eventWith({ callSid: 'CA1', outcome: 'DNC', localDate: '2026-09-24' }), context);
    expect(result.ok).toBe(true);
    expect(result.companyMarkedDnc).toBe(false);
    expect(result.warning).toContain('DNC switch by hand');
  });

  it('explains DNC for a person with no company', async () => {
    records['people:p1'].companyId = null;
    const result = await handler(eventWith({ callSid: 'CA1', outcome: 'DNC' }), context);
    expect(result.ok).toBe(true);
    expect(result.warning).toContain('no company');
  });

  it("refuses another rep's call and unknown outcomes", async () => {
    expect((await handler(eventWith({ callSid: 'CA1', outcome: 'DNC' }), { ...context, workspaceMemberId: 'rep-2' })).ok).toBe(false);
    expect((await handler(eventWith({ callSid: 'CA1', outcome: 'MAYBE' }), context)).ok).toBe(false);
  });

  it('saving again updates the same record instead of creating a duplicate', async () => {
    await handler(eventWith({ callSid: 'CA1', outcome: 'VOICEMAIL', localDate: '2026-09-24' }), context);
    await handler(eventWith({ callSid: 'CA1', outcome: 'HIGH_INTEREST', localDate: '2026-09-24' }), context);
    expect(creates).toHaveLength(1);
    expect(updates.some((u) => u.object === 'dialerCalls' && u.id === 'new-call-record')).toBe(true);
  });
});

describe('starting a call', () => {
  const start = startCall.config.handler as (event: any, context: any) => Promise<any>;
  beforeEach(() => {
    dialed.length = 0;
    process.env.SIGNALWIRE_PROJECT_ID = 'ACproject';
    process.env.SIGNALWIRE_API_TOKEN = 'token'; process.env.SIGNALWIRE_SIGNING_KEY = 'token'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    process.env.DIALER_REPS = JSON.stringify({
      'ricky@beagleforpm.com': { callerId: '+15550000000', ringTo: '+15559999999' },
    });
    records['workspaceMembers:rep-1'] = { id: 'rep-1', userEmail: 'ricky@beagleforpm.com' };
    records['people:p1'].phones = { primaryPhoneNumber: '5551234567', primaryPhoneCallingCode: '+1' };
  });

  it('dials when nothing is marked Do Not Call', async () => {
    const result = await start(eventWith({ personId: 'p1' }), context);
    expect(result.ok).toBe(true);
    expect(dialed).toEqual(['+15559999999']);
  });

  it('refuses to dial anyone at a DNC company, without contacting Twilio', async () => {
    records['companies:c1'].dnc = true;
    const result = await start(eventWith({ personId: 'p1' }), context);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Do Not Call');
    expect(dialed).toEqual([]);
  });

  it('refuses when only the Lead Status says DNC', async () => {
    records['companies:c1'].leadStatus = 'DNC';
    expect((await start(eventWith({ personId: 'p1' }), context)).ok).toBe(false);
    expect(dialed).toEqual([]);
  });
});

describe('an outcome is required after every answered call', () => {
  const start = startCall.config.handler as (event: any, context: any) => Promise<any>;
  const save = saveOutcome.config.handler as (event: any, context: any) => Promise<any>;
  const bridgeHandler = bridge.config.handler as (event: any) => Promise<any>;
  // Twilio signs its "rep answered" request with the Auth Token.
  const answer = async (event: any) => {
    const { signFormRequest } = await import('src/shared/twilio-signature');
    const { ROUTE_BRIDGE } = await import('src/constants/universal-identifiers');
    const signature = signFormRequest(
      process.env.SIGNALWIRE_SIGNING_KEY ?? '',
      `https://corgi-smb.withtwenty.com${ROUTE_BRIDGE}`,
      event.body,
    );
    return bridgeHandler({ ...event, headers: { 'x-signalwire-signature': signature } });
  };
  const mine = myCall.config.handler as (event: any, context: any) => Promise<any>;
  const endCall = (sid: string, endReason = 'completed') => {
    storedCalls[sid] = { ...storedCalls[sid], stage: 'ended', endReason };
  };

  beforeEach(() => {
    dialed.length = 0;
    process.env.SIGNALWIRE_PROJECT_ID = 'ACproject';
    process.env.SIGNALWIRE_API_TOKEN = 'token'; process.env.SIGNALWIRE_SIGNING_KEY = 'token'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    process.env.DIALER_REPS = JSON.stringify({
      'ricky@beagleforpm.com': { callerId: '+15550000000', ringTo: '+15559999999' },
    });
    records['workspaceMembers:rep-1'] = { id: 'rep-1', userEmail: 'ricky@beagleforpm.com' };
    records['people:p1'].phones = { primaryPhoneNumber: '5551234567', primaryPhoneCallingCode: '+1' };
    delete storedCalls.CA1;
  });

  it('blocks the next call until the last one has an outcome, then allows it', async () => {
    expect((await start(eventWith({ personId: 'p1' }), context)).ok).toBe(true);
    await answer(eventWith({ CallSid: 'CA-new' }));
    expect(storedCalls['CA-new'].repAnswered).toBe(true);
    endCall('CA-new');

    const blocked = await start(eventWith({ personId: 'p1' }), context);
    expect(blocked).toMatchObject({ ok: false, needsOutcome: true });
    expect(dialed).toHaveLength(1);

    const pending = await mine(eventWith({}), context);
    expect(pending.call).toMatchObject({ callSid: 'CA-new', needsOutcome: true, personName: 'Jane Doe' });

    expect((await save(eventWith({ callSid: 'CA-new', outcome: 'VOICEMAIL', localDate: '2026-09-24' }), context)).ok).toBe(true);
    expect(storedCalls['CA-new'].outcomeSaved).toBe(true);
    expect((await mine(eventWith({}), context)).call).toBeNull();
    expect((await start(eventWith({ personId: 'p1' }), context)).ok).toBe(true);
  });

  it('refuses a second call while one is still going', async () => {
    await start(eventWith({ personId: 'p1' }), context);
    const second = await start(eventWith({ personId: 'p1' }), context);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('already on a call');
    expect((await mine(eventWith({}), context)).call).toMatchObject({ isActive: true, needsOutcome: false });
  });

  it("doesn't require an outcome if the rep never picked up", async () => {
    await start(eventWith({ personId: 'p1' }), context);
    endCall('CA-new', 'rep-no-answer');
    expect((await start(eventWith({ personId: 'p1' }), context)).ok).toBe(true);
  });

  it('treats a call stuck for over 2 hours as finished', () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const stuck: any = { callSid: 'x', stage: 'connected', createdAt: old, repAnswered: true };
    expect(isCallActive(stuck)).toBe(false);
    expect(callNeedsOutcome(stuck)).toBe(true);
    expect(callNeedsOutcome({ ...stuck, outcomeSaved: true })).toBe(false);
  });
});

describe('after a DNC outcome is saved', () => {
  const start = startCall.config.handler as (event: any, context: any) => Promise<any>;
  const save = saveOutcome.config.handler as (event: any, context: any) => Promise<any>;

  beforeEach(() => {
    dialed.length = 0;
    process.env.SIGNALWIRE_PROJECT_ID = 'ACproject';
    process.env.SIGNALWIRE_API_TOKEN = 'token'; process.env.SIGNALWIRE_SIGNING_KEY = 'token'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    process.env.DIALER_REPS = JSON.stringify({
      'ricky@beagleforpm.com': { callerId: '+15550000000', ringTo: '+15559999999' },
    });
    records['workspaceMembers:rep-1'] = { id: 'rep-1', userEmail: 'ricky@beagleforpm.com' };
    records['people:p1'].phones = { primaryPhoneNumber: '5551234567', primaryPhoneCallingCode: '+1' };
    records['people:p9'] = { id: 'p9', companyId: 'c1', phones: { primaryPhoneNumber: '5557654321', primaryPhoneCallingCode: '+1' } };
  });

  it('nobody at that company can be dialed afterwards, and Twilio is never contacted', async () => {
    // A fake updateRecord records changes; apply them so the company really becomes DNC.
    await save(eventWith({ callSid: 'CA1', outcome: 'DNC', localDate: '2026-09-24' }), context);
    for (const u of updates.filter((x) => x.object === 'companies')) {
      Object.assign(records[`companies:${u.id}`], u.data);
    }
    expect(records['companies:c1']).toMatchObject({ dnc: true, leadStatus: 'DNC' });

    const samePerson = await start(eventWith({ personId: 'p1' }), context);
    const coworker = await start(eventWith({ personId: 'p9' }), context);
    expect(samePerson.ok).toBe(false);
    expect(coworker.ok).toBe(false);
    expect(coworker.message).toContain('Do Not Call');
    expect(dialed).toEqual([]);
  });
});
