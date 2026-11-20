import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Fake Twenty records -----------------------------------------------------
const records: Record<string, any> = {};
const creates: Array<{ object: string; data: any }> = [];
const updates: Array<{ object: string; id: string; data: any; runAs?: string }> = [];
let lists: Record<string, any[]> = {};
let createdCount = 0;

vi.mock('src/shared/twenty-api', () => ({
  functionsBaseUrl: () => 'https://corgi.example.com/s',
  getRecord: async (object: string, id: string) => records[`${object}:${id}`] ?? null,
  listRecords: async (object: string) => lists[object] ?? [],
  createRecord: async (object: string, data: any) => {
    creates.push({ object, data });
    createdCount += 1;
    return { id: `rec-${createdCount}` };
  },
  updateRecord: async (object: string, id: string, data: any, runAs?: string) => {
    updates.push({ object, id, data, runAs });
    return { id };
  },
}));

// --- Fake Twilio ---------------------------------------------------------------
const dialed: string[] = [];
const ended: string[] = [];
const recorded: string[] = [];
let legCount = 0;
vi.mock('src/shared/twilio', () => ({
  ringRepPhone: async () => 'CA-rep',
  dialProspect: async (_settings: unknown, input: { to: string }) => {
    dialed.push(input.to);
    legCount += 1;
    return `CA-leg-${legCount}`;
  },
  endCall: async (_settings: unknown, sid: string) => {
    ended.push(sid);
  },
  startRecording: async (_settings: unknown, sid: string) => {
    recorded.push(sid);
  },
}));

import sessionStart from 'src/logic-functions/session-start.logic-function';
import sessionStatus from 'src/logic-functions/session-status.logic-function';
import sessionControl from 'src/logic-functions/session-control.logic-function';
import repAnswered from 'src/logic-functions/session-rep-answered.logic-function';
import repEvents from 'src/logic-functions/session-rep-events.logic-function';
import legAnswered from 'src/logic-functions/session-leg-answered.logic-function';
import legEvents from 'src/logic-functions/session-leg-events.logic-function';
import saveOutcome from 'src/logic-functions/save-outcome.logic-function';
import startCall from 'src/logic-functions/start-call.logic-function';
import {
  ROUTE_SESSION_LEG_ANSWERED,
  ROUTE_SESSION_LEG_EVENTS,
  ROUTE_SESSION_REP_ANSWERED,
  ROUTE_SESSION_REP_EVENTS,
} from 'src/constants/universal-identifiers';
import { blockNumber } from 'src/shared/dnc';
import { foldFinishedBatch } from 'src/shared/session-engine';
import { getLeg, type Session } from 'src/shared/session-store';
import { signFormRequest } from 'src/shared/twilio-signature';

const TOKEN = 'test-auth-token';
const context = { workspaceMemberId: 'rep-1', workspaceId: 'w', userWorkspaceId: 'u', retryCount: 0, maxRetries: 0 };

const userEvent = (body: Record<string, unknown> = {}) => ({
  headers: {}, queryStringParameters: {}, pathParameters: {}, body, isBase64Encoded: false,
  requestContext: { http: { method: 'POST', path: '/x' } }, userWorkspaceId: 'u',
});

// A request from Twilio, correctly signed with the Auth Token.
const twilioEvent = (route: string, body: Record<string, string>, signed = true) => ({
  headers: signed
    ? { 'x-twilio-signature': signFormRequest(TOKEN, `https://corgi.example.com/s${route}`, body) }
    : {},
  queryStringParameters: {}, pathParameters: {}, body, isBase64Encoded: false,
  requestContext: { http: { method: 'POST', path: route } }, userWorkspaceId: null,
});

const run = (fn: any, event: any, ctx: any = context) => fn.config.handler(event, ctx);
const status = () => run(sessionStatus, userEvent());
const xml = (response: any) => String(response.body);

const person = (id: string, phone: string | null, extra: Record<string, unknown> = {}) => {
  records[`people:${id}`] = {
    id,
    name: { firstName: id.toUpperCase(), lastName: 'Test' },
    phones: phone ? { primaryPhoneNumber: phone, primaryPhoneCallingCode: '+1' } : null,
    companyId: null,
    ...extra,
  };
};

const startSession = async (ids: string[], options: Record<string, unknown> = {}) =>
  run(sessionStart, userEvent({ object: 'person', recordIds: ids, mode: 'parallel', lines: 5, ...options }));

const repPicksUp = async () => {
  await run(repAnswered, twilioEvent(ROUTE_SESSION_REP_ANSWERED, { CallSid: 'CA-rep' }));
  return run(repAnswered, twilioEvent(ROUTE_SESSION_REP_ANSWERED, { CallSid: 'CA-rep', Digits: '1' }));
};

const answer = (sid: string, answeredBy: string) =>
  run(legAnswered, twilioEvent(ROUTE_SESSION_LEG_ANSWERED, { CallSid: sid, AnsweredBy: answeredBy }));

const legStatus = (sid: string, callStatus: string, duration = '0') =>
  run(legEvents, twilioEvent(ROUTE_SESSION_LEG_EVENTS, { CallSid: sid, CallStatus: callStatus, CallDuration: duration }));

beforeEach(() => {
  for (const key of Object.keys(records)) delete records[key];
  creates.length = 0;
  updates.length = 0;
  dialed.length = 0;
  ended.length = 0;
  recorded.length = 0;
  lists = {};
  legCount = 0;
  createdCount = 0;
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  process.env.RECORDING_ANNOUNCEMENT = 'This call may be recorded.';
  process.env.DIALER_REPS = JSON.stringify({
    'ricky@beagleforpm.com': { callerId: '+15550000000', ringTo: '+15559999999' },
  });
  records['workspaceMembers:rep-1'] = { id: 'rep-1', userEmail: 'ricky@beagleforpm.com', name: { firstName: 'Ricky', lastName: 'Thomas' } };
  records['companies:c-dnc'] = { id: 'c-dnc', name: 'Blocked Co', dnc: true };
  records['companies:c-ok'] = { id: 'c-ok', name: 'Open Co', phone: { primaryPhoneNumber: '3125550100', primaryPhoneCallingCode: '+1' } };
  records['companies:c-flag'] = { id: 'c-flag', name: 'Flag Co', doNotCall: true, phone: { primaryPhoneNumber: '3125550199', primaryPhoneCallingCode: '+1' } };
  records['companies:c-main'] = { id: 'c-main', name: 'Main Line Co', phone: { primaryPhoneNumber: '' }, companyPhone: { primaryPhoneNumber: '3125550111', primaryPhoneCallingCode: '+1' } };
});

describe('Do Not Call is never dialed', () => {
  it('skips every kind of DNC and only dials the rest', async () => {
    person('a', '5550001001');
    person('b', '5550001002', { companyId: 'c-dnc' }); // company DNC switch
    person('c', '5550001003', { doNotCall: true }); // person flag
    person('d', '5550001004', { leadStatus: 'DNC' }); // person lead status
    person('e', '5550001005', { callDisposition: 'DO_NOT_CALL_IN_PROGRESS' });
    person('f', '5550001006'); // number saved as DNC earlier
    person('g', null); // no number
    person('h', '5550001001'); // same number as a
    await blockNumber('+15550001006');

    expect((await startSession(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).ok).toBe(true);
    await repPicksUp();
    const view = (await status()).session;

    expect(dialed).toEqual(['+15550001001']);
    expect(view.counts.skippedDnc).toBe(5);
    expect(view.counts.noNumber).toBe(1);
  });

  it('a company marked DNC between batches is skipped when its turn comes', async () => {
    person('a', '5550002001');
    person('b', '5550002002', { companyId: 'c-ok' });
    await startSession(['a', 'b'], { mode: 'power' });
    await repPicksUp();
    await status();
    expect(dialed).toEqual(['+15550002001']);

    records['companies:c-ok'].leadStatus = 'DNC';
    await legStatus('CA-leg-1', 'no-answer');
    await status();
    expect(dialed).toEqual(['+15550002001']);
  });

  it('dialing companies skips any DNC flag on the company', async () => {
    await run(sessionStart, userEvent({ object: 'company', recordIds: ['c-ok', 'c-flag', 'c-dnc', 'c-main'], mode: 'parallel', lines: 5 }));
    await repPicksUp();
    await status();
    expect(dialed).toEqual(['+13125550100', '+13125550111']);
  });

  it('a one-off call to a blocked number is refused too', async () => {
    person('z', '5550009999');
    await blockNumber('+15550009999');
    const result = await run(startCall, userEvent({ personId: 'z' }));
    expect(result.ok).toBe(false);
    expect(dialed).toEqual([]);
  });

  it('saving DNC blocks the number for every future call', async () => {
    person('a', '5550003001');
    person('dup', '5550003001'); // same number, different record
    await startSession(['a'], { mode: 'power' });
    await repPicksUp();
    await status();
    await answer('CA-leg-1', 'human');
    await legStatus('CA-leg-1', 'completed', '30');
    const saved = await run(saveOutcome, userEvent({ callSid: 'CA-leg-1', outcome: 'DNC', localDate: '2026-11-13' }));
    expect(saved.ok).toBe(true);

    await run(sessionControl, userEvent({ action: 'close' }));
    dialed.length = 0;
    await startSession(['dup']);
    await repPicksUp();
    await status();
    expect(dialed).toEqual([]);
  });
});

describe('parallel dialing', () => {
  beforeEach(() => {
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) person(id, `55500040${id.slice(1)}0`);
  });

  it("doesn't dial until the rep picks up their phone", async () => {
    await startSession(['p1', 'p2']);
    await status();
    expect(dialed).toEqual([]);
    await repPicksUp();
    await status();
    expect(dialed).toHaveLength(2);
  });

  it("the rep's voicemail can't start a session: the rep has to press 1", async () => {
    await startSession(['p1', 'p2']);
    const prompt = await run(repAnswered, twilioEvent(ROUTE_SESSION_REP_ANSWERED, { CallSid: 'CA-rep' }));
    expect(xml(prompt)).toContain('<Gather');
    expect(xml(prompt)).not.toContain('<Conference');
    await status();
    expect(dialed).toEqual([]);
    const joined = await run(repAnswered, twilioEvent(ROUTE_SESSION_REP_ANSWERED, { CallSid: 'CA-rep', Digits: '1' }));
    expect(xml(joined)).toContain('<Conference');
    await status();
    expect(dialed).toHaveLength(2);
  });

  it('dials as many lines as chosen, and logs each attempt as the rep', async () => {
    await startSession(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], { lines: 5 });
    await repPicksUp();
    await status();
    expect(dialed).toHaveLength(5);
    expect(creates.filter((c) => c.object === 'dialerCalls')).toHaveLength(5);
    expect(creates[0].data).toMatchObject({ rep: 'Ricky Thomas', callResult: 'IN_PROGRESS' });
  });

  it('voicemail is hung up and logged; the rep never hears it', async () => {
    await startSession(['p1', 'p2']);
    await repPicksUp();
    await status();
    const response = await answer('CA-leg-1', 'machine_start');
    expect(xml(response)).toContain('<Hangup/>');
    expect(xml(response)).not.toContain('<Conference');
    expect(updates).toContainEqual(
      expect.objectContaining({ object: 'dialerCalls', data: expect.objectContaining({ callResult: 'VOICEMAIL', outcome: 'VOICEMAIL' }) }),
    );
  });

  it('first person to pick up is connected; a second is hung up and flagged to call back', async () => {
    await startSession(['p1', 'p2', 'p3']);
    await repPicksUp();
    await status();

    const [first, second] = await Promise.all([answer('CA-leg-1', 'human'), answer('CA-leg-2', 'human')]);
    const responses = [xml(first), xml(second)];
    const joined = responses.filter((r) => r.includes('<Conference'));
    const hungUp = responses.filter((r) => r.includes('<Hangup/>'));
    expect(joined).toHaveLength(1);
    expect(hungUp).toHaveLength(1);
    expect(joined[0]).toContain('<Say>This call may be recorded.</Say>');

    // The other ringing line is hung up so nobody else picks up.
    expect(ended).toContain('CA-leg-3');
    const view = (await status()).session;
    expect(view.connected).not.toBeNull();
    expect(view.dropped).toHaveLength(1);
    expect(updates).toContainEqual(
      expect.objectContaining({ data: expect.objectContaining({ callResult: 'DROPPED' }) }),
    );
  });

  it('starts recording the connected call', async () => {
    await startSession(['p1']);
    await repPicksUp();
    await status();
    await answer('CA-leg-1', 'human');
    expect(recorded).toEqual(['CA-leg-1']);
  });

  it('waits for an outcome after a conversation, then dials the next batch', async () => {
    await startSession(['p1', 'p2', 'p3', 'p4'], { lines: 2 });
    await repPicksUp();
    await status();
    expect(dialed).toHaveLength(2);

    await answer('CA-leg-1', 'human');
    await legStatus('CA-leg-2', 'completed', '0'); // hung up by us
    await legStatus('CA-leg-1', 'completed', '45'); // conversation over
    let view = (await status()).session;
    expect(view.needsOutcome?.callSid).toBe('CA-leg-1');
    expect(dialed).toHaveLength(2);

    const saved = await run(saveOutcome, userEvent({ callSid: 'CA-leg-1', outcome: 'HIGH_INTEREST', localDate: '2026-11-13' }));
    expect(saved.ok).toBe(true);
    view = (await status()).session;
    expect(view.needsOutcome).toBeNull();
    expect(dialed).toHaveLength(4);
  });

  it('a line hung up because someone else answered goes back on the list once', () => {
    const session = {
      targets: [{ kind: 'person', id: 'p1' }, { kind: 'person', id: 'p2' }],
      results: [
        { index: 0, legSid: 'L1', status: 'dialing' },
        { index: 1, legSid: 'L2', status: 'dialing' },
      ],
      batch: { number: 1, legSids: ['L1', 'L2'] },
    } as unknown as Session;
    const folded = foldFinishedBatch(session, [
      { callSid: 'L1', status: 'done', answeredBy: 'human' },
      { callSid: 'L2', status: 'canceled' },
    ] as any);
    expect(folded.targets).toHaveLength(3);
    expect(folded.targets[2]).toMatchObject({ id: 'p2', retried: true });
    expect(foldFinishedBatch({ ...folded, results: folded.results.map((r) => ({ ...r })) } as Session, []).targets).toHaveLength(3);
  });

  it('pause stops new calls; resume picks back up', async () => {
    await startSession(['p1', 'p2'], { mode: 'power' });
    await repPicksUp();
    await run(sessionControl, userEvent({ action: 'pause' }));
    await status();
    expect(dialed).toHaveLength(0);
    await run(sessionControl, userEvent({ action: 'resume' }));
    await status();
    expect(dialed).toHaveLength(1);
  });

  it('when the rep hangs up their phone, the session ends and ringing lines are hung up', async () => {
    await startSession(['p1', 'p2']);
    await repPicksUp();
    await status();
    await run(repEvents, twilioEvent(ROUTE_SESSION_REP_EVENTS, { CallSid: 'CA-rep', CallStatus: 'completed' }));
    const view = (await status()).session;
    expect(view.state).toBe('ended');
    expect(ended).toEqual(expect.arrayContaining(['CA-leg-1', 'CA-leg-2']));
  });

  it('a one-off call is refused while a session is running', async () => {
    await startSession(['p1']);
    const result = await run(startCall, userEvent({ personId: 'p2' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/power dialer/i);
  });

  it('ignores Twilio requests that are not signed', async () => {
    await startSession(['p1']);
    await repPicksUp();
    await status();
    const response = await run(
      legAnswered,
      twilioEvent(ROUTE_SESSION_LEG_ANSWERED, { CallSid: 'CA-leg-1', AnsweredBy: 'human' }, false),
    );
    expect(response.status).toBe(403);
    expect((await getLeg('CA-leg-1'))?.status).toBe('dialing');
  });
});
