import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: Array<{ object: string; id: string; data: any; runAs?: string }> = [];
const creates: Array<{ object: string; data: any }> = [];
const records: Record<string, any> = {};

vi.mock('src/shared/twenty-api', () => ({
  functionsBaseUrl: () => 'https://corgi-smb.withtwenty.com',
  getRecord: async (object: string, id: string) => records[`${object}:${id}`] ?? null,
  listRecords: async () => [],
  createRecord: async (object: string, data: any) => {
    creates.push({ object, data });
    return { id: 'rec-1' };
  },
  updateRecord: async (object: string, id: string, data: any, runAs?: string) => {
    updates.push({ object, id, data, runAs });
    return { id };
  },
}));

const stored: Record<string, any> = {};
const latestByRep: Record<string, string> = {};
vi.mock('src/shared/call-store', async () => {
  const actual = await vi.importActual<typeof import('src/shared/call-store')>('src/shared/call-store');
  return {
    getCall: async (sid: string) => stored[sid] ?? null,
    saveCall: async (call: any) => {
      stored[call.callSid] = call;
    },
    updateCall: async (sid: string, changes: any) => {
      stored[sid] = { ...stored[sid], ...changes };
      return stored[sid];
    },
    setRepLatestCall: async (memberId: string, sid: string) => {
      latestByRep[memberId] = sid;
    },
    getRepLatestCall: async (memberId: string) =>
      latestByRep[memberId] ? stored[latestByRep[memberId]] ?? null : null,
    isCallActive: actual.isCallActive,
    callNeedsOutcome: actual.callNeedsOutcome,
  };
});

vi.mock('src/shared/twilio', () => ({
  ringRepPhone: async () => 'CA-parent',
  endCall: async () => undefined,
}));

import { callResultForEndReason } from 'src/shared/call-results';
import { signFormRequest } from 'src/shared/twilio-signature';
import bridge from 'src/logic-functions/bridge.logic-function';
import callEvents from 'src/logic-functions/call-events.logic-function';
import recordingReady, { toPlayableUrl } from 'src/logic-functions/recording-ready.logic-function';
import startCall from 'src/logic-functions/start-call.logic-function';
import whisper from 'src/logic-functions/whisper.logic-function';

const run = (fn: any, body: Record<string, string>, headers: Record<string, string> = {}) =>
  fn.config.handler(
    {
      headers, queryStringParameters: {}, pathParameters: {}, body, isBase64Encoded: false,
      requestContext: { http: { method: 'POST', path: '/x' } }, userWorkspaceId: null,
    },
    { workspaceMemberId: 'rep-1', workspaceId: 'w', userWorkspaceId: 'u', retryCount: 0, maxRetries: 0 },
  );

beforeEach(() => {
  updates.length = 0;
  creates.length = 0;
  for (const k of Object.keys(stored)) delete stored[k];
  for (const k of Object.keys(latestByRep)) delete latestByRep[k];
  for (const k of Object.keys(records)) delete records[k];
  delete process.env.SIGNALWIRE_SIGNING_KEY;
  process.env.RECORDING_ANNOUNCEMENT = 'Hello. This call may be recorded.';
  stored['CA-parent'] = {
    callSid: 'CA-parent', workspaceMemberId: 'rep-1', personId: 'p1', prospectNumber: '+15551234567',
    callerId: '+15550000000', stage: 'rep-ringing', loggedRecordId: 'rec-1', createdAt: '2026-09-24T18:00:00.000Z',
  };
});

describe('calling instructions', () => {
  it('records both sides and plays the announcement to the person called', async () => {
    const res = await run(bridge, { CallSid: 'CA-parent' });
    const xml = String(res.body);
    expect(xml).toContain('record="record-from-answer"');
    expect(xml).toContain('recordingStatusCallback="https://corgi-smb.withtwenty.com/dialer/recording-ready"');
    expect(xml).toContain('url="https://corgi-smb.withtwenty.com/dialer/whisper"');
    expect(xml).toContain('+15551234567');
  });

  it('skips the announcement when it is cleared in settings (still records)', async () => {
    process.env.RECORDING_ANNOUNCEMENT = '';
    const xml = String((await run(bridge, { CallSid: 'CA-parent' })).body);
    expect(xml).not.toContain('/dialer/whisper');
    expect(xml).toContain('record="record-from-answer"');
  });

  it('the announcement says the configured words, safely escaped', async () => {
    process.env.RECORDING_ANNOUNCEMENT = 'Calls are recorded & reviewed <always>.';
    const xml = String((await run(whisper, { CallSid: 'CA-child' })).body);
    expect(xml).toContain('<Say>Calls are recorded &amp; reviewed &lt;always&gt;.</Say>');
  });

  it('ignores fake requests once a Auth Token is set', async () => {
    process.env.SIGNALWIRE_API_TOKEN = 'key'; process.env.SIGNALWIRE_SIGNING_KEY = 'key'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    const res = await run(whisper, { CallSid: 'CA-child' }, { 'x-twilio-signature': 'forged' });
    expect(res.status).toBe(403);
  });
});

describe('recordings', () => {
  it('links the MP3 onto the Dialer Call record', async () => {
    await run(recordingReady, {
      CallSid: 'CA-parent', RecordingStatus: 'completed', RecordingDuration: '94',
      RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/ACa/Recordings/RE1',
    });
    expect(updates).toEqual([
      {
        object: 'dialerCalls', id: 'rec-1', runAs: 'application',
        data: {
          recording: {
            primaryLinkUrl: 'https://api.twilio.com/2010-04-01/Accounts/ACa/Recordings/RE1.mp3',
            primaryLinkLabel: 'Play recording', secondaryLinks: null,
          },
          recordingSeconds: 94,
        },
      },
    ]);
  });

  it('finds the call from the person-side leg too', async () => {
    await run(recordingReady, {
      CallSid: 'CA-child', ParentCallSid: 'CA-parent', RecordingStatus: 'completed', RecordingUrl: 'https://x/Recordings/r2',
    });
    expect(updates[0].id).toBe('rec-1');
  });

  it('ignores recordings that are not finished', async () => {
    await run(recordingReady, { CallSid: 'CA-parent', RecordingStatus: 'in-progress', RecordingUrl: 'https://x/r' });
    expect(updates).toEqual([]);
  });

  it('accepts a genuinely signed recording update when a Auth Token is set', async () => {
    process.env.SIGNALWIRE_API_TOKEN = 'key'; process.env.SIGNALWIRE_SIGNING_KEY = 'key'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    const params = { CallSid: 'CA-parent', RecordingStatus: 'completed', RecordingUrl: 'https://x/Recordings/r3' };
    const signature = signFormRequest('key', 'https://corgi-smb.withtwenty.com/dialer/recording-ready', params);
    await run(recordingReady, params, { 'x-twilio-signature': signature });
    expect(updates).toHaveLength(1);
  });

  it('turns recording links into playable MP3 links', () => {
    expect(toPlayableUrl('https://x/Recordings/r')).toBe('https://x/Recordings/r.mp3');
    expect(toPlayableUrl('https://x/Recordings/r.wav')).toBe('https://x/Recordings/r.wav');
  });
});

describe('call result on the record', () => {
  it('marks Connected when the person answers, then keeps it when the call ends', async () => {
    await run(callEvents, { CallSid: 'CA-child', ParentCallSid: 'CA-parent', CallStatus: 'in-progress' });
    await run(callEvents, { CallSid: 'CA-child', ParentCallSid: 'CA-parent', CallStatus: 'completed', CallDuration: '61' });
    expect(updates.map((u) => u.data)).toEqual([
      { callResult: 'CONNECTED' },
      { callResult: 'CONNECTED', durationSeconds: 61 },
    ]);
    expect(updates.every((u) => u.runAs === 'application')).toBe(true);
  });

  it('marks Busy / No answer / Rep didn\'t pick up', async () => {
    await run(callEvents, { CallSid: 'CA-child', ParentCallSid: 'CA-parent', CallStatus: 'busy' });
    expect(updates[updates.length - 1]?.data.callResult).toBe('BUSY');
    expect(callResultForEndReason('prospect-no-answer', false)).toBe('NO_ANSWER');
    expect(callResultForEndReason('rep-no-answer', false)).toBe('REP_MISSED');
    expect(callResultForEndReason('hung-up', false)).toBe('CANCELED');
    expect(callResultForEndReason('hung-up', true)).toBe('CONNECTED');
  });
});

describe('starting a call creates the record right away', () => {
  it('as the rep, with their name, In progress', async () => {
    process.env.SIGNALWIRE_PROJECT_ID = 'ACp';
    process.env.SIGNALWIRE_API_TOKEN = 't'; process.env.SIGNALWIRE_SIGNING_KEY = 't'; process.env.SIGNALWIRE_SPACE_URL = 'corgi.signalwire.com';
    process.env.DIALER_REPS = JSON.stringify({ 'ricky@beagleforpm.com': { callerId: '+15550000000', ringTo: '+15559999999' } });
    records['workspaceMembers:rep-1'] = { id: 'rep-1', userEmail: 'ricky@beagleforpm.com', name: { firstName: 'Ricky', lastName: 'Thomas' } };
    records['people:p1'] = { id: 'p1', name: { firstName: 'Jane', lastName: 'Doe' }, companyId: 'c1', phones: { primaryPhoneNumber: '5551234567', primaryPhoneCallingCode: '+1' } };
    records['companies:c1'] = { id: 'c1', name: 'Acme' };

    const result = await run(startCall, { personId: 'p1' });
    expect(result.ok).toBe(true);
    expect(creates[0]).toMatchObject({
      object: 'dialerCalls',
      data: { name: 'Jane Doe (call)', rep: 'Ricky Thomas', callResult: 'IN_PROGRESS', personId: 'p1', companyId: 'c1' },
    });
    expect(stored['CA-parent']).toMatchObject({ loggedRecordId: 'rec-1', repName: 'Ricky Thomas' });
  });
});
