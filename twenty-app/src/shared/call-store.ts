import { kv } from 'twenty-sdk/logic-function';

// What the panel shows. "rep-ringing" = the rep's own phone is ringing,
// "prospect-ringing" = rep picked up and we're dialing the prospect.
export type CallStage =
  | 'starting'
  | 'rep-ringing'
  | 'prospect-ringing'
  | 'connected'
  | 'ended'
  | 'failed';

export type StoredCall = {
  callSid: string;
  workspaceMemberId: string;
  personId: string;
  prospectNumber: string;
  callerId: string;
  stage: CallStage;
  endReason?: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  loggedRecordId?: string;
  recordingUrl?: string;
  recordingSeconds?: number;
  repName?: string;
  // The rep picked up their phone, so a real attempt happened.
  repAnswered?: boolean;
  // The rep has saved an outcome for this call.
  outcomeSaved?: boolean;
  createdAt: string;
};

const keyFor = (callSid: string) => `call:${callSid}`;

export const saveCall = (call: StoredCall) => kv.set(keyFor(call.callSid), call);

export const getCall = (callSid: string) => kv.get<StoredCall>(keyFor(callSid));

export const updateCall = async (
  callSid: string,
  changes: Partial<StoredCall>,
): Promise<StoredCall | null> => {
  const existing = await getCall(callSid);
  if (!existing) {
    return null;
  }
  const updated = { ...existing, ...changes };
  await saveCall(updated);
  return updated;
};

// Each rep's most recent call, so the dialer can resume it and insist on an
// outcome before the next call.
const repLatestKey = (workspaceMemberId: string) => `rep-latest-call:${workspaceMemberId}`;

export const setRepLatestCall = (workspaceMemberId: string, callSid: string) =>
  kv.set(repLatestKey(workspaceMemberId), callSid);

export const getRepLatestCall = async (
  workspaceMemberId: string,
): Promise<StoredCall | null> => {
  const callSid = await kv.get<string>(repLatestKey(workspaceMemberId));
  return callSid ? getCall(callSid) : null;
};

// A call that never reported "ended" (for example a lost update) stops
// counting as active after this long.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const isStale = (call: StoredCall, now: number) =>
  now - Date.parse(call.createdAt) > STALE_AFTER_MS;

export const isCallActive = (call: StoredCall | null, now = Date.now()) =>
  Boolean(call) &&
  call!.stage !== 'ended' &&
  call!.stage !== 'failed' &&
  !isStale(call!, now);

// The rep answered, the call is over, and no outcome was saved yet.
export const callNeedsOutcome = (call: StoredCall | null, now = Date.now()) =>
  Boolean(call) &&
  call!.repAnswered === true &&
  call!.outcomeSaved !== true &&
  (call!.stage === 'ended' || isStale(call!, now));
