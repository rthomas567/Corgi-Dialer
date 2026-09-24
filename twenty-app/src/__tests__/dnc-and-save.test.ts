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
vi.mock('src/shared/call-store', () => ({
  getCall: async (sid: string) => storedCalls[sid] ?? null,
  updateCall: async (sid: string, changes: Record<string, unknown>) => {
    storedCalls[sid] = { ...storedCalls[sid], ...changes };
    return storedCalls[sid];
  },
  saveCall: async () => undefined,
}));

const dialed: string[] = [];
vi.mock('src/shared/signalwire', () => ({
  ringRepPhone: async (_settings: unknown, input: { repPhone: string }) => {
    dialed.push(input.repPhone);
    return 'CA-new';
  },
  endCall: async () => undefined,
}));

import { getDoNotCallStatus, isCalendarDate, isCompanyDoNotCall } from 'src/shared/dnc';
import startCall from 'src/logic-functions/start-call.logic-function';
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
    expect(status.reason).toContain('Acme Realty');
  });

  it('blocks a person with no company after a DNC call', async () => {
    records['people:p2'] = { id: 'p2', companyId: null };
    lists.dialerCalls = [{ id: 'x', outcome: 'VOICEMAIL' }, { id: 'y', outcome: 'DNC' }];
    expect((await getDoNotCallStatus('p2')).doNotCall).toBe(true);
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

  it('DNC turns on the switch and sets Lead Status to DNC', async () => {
    const result = await handler(eventWith({ callSid: 'CA1', outcome: 'DNC', localDate: '2026-09-24' }), context);
    expect(result).toMatchObject({ ok: true, companyMarkedDnc: true, warning: null });
    expect(updates).toEqual([
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
    process.env.SIGNALWIRE_SPACE_URL = 'corgi-atlas.signalwire.com';
    process.env.SIGNALWIRE_PROJECT_ID = 'project';
    process.env.SIGNALWIRE_API_TOKEN = 'token';
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

  it('refuses to dial anyone at a DNC company, without contacting SignalWire', async () => {
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
