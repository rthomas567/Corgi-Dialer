import { kv } from 'twenty-sdk/logic-function';

// A power / parallel dialing session: one rep working through a list.
//
// What's stored where (so updates arriving at the same time don't overwrite
// each other):
//   session:{id}       the list, where we are in it, and results so far.
//                      Only changed by the rep's own screen (start, the
//                      regular status check, pause, stop), one at a time.
//   session-rep:{id}   the rep's own phone line. Changed by Twilio updates.
//   leg:{callSid}      one dialed prospect. Changed by Twilio updates.
//   claim:{id}:{batch} which prospect got connected to the rep in a batch.

export type TargetKind = 'person' | 'company' | 'queue';

export type SessionTarget = { kind: TargetKind; id: string; retried?: boolean };

export type TargetStatus =
  | 'dialing'
  | 'ringing'
  | 'answered'
  | 'connected'
  | 'voicemail'
  | 'no-answer'
  | 'busy'
  | 'failed'
  | 'dropped'
  | 'canceled'
  | 'done'
  | 'skipped-dnc'
  | 'skipped-no-number'
  | 'skipped-duplicate';

export type TargetResult = {
  index: number;
  kind: TargetKind;
  id: string;
  personId: string | null;
  companyId: string | null;
  queueItemId: string | null;
  name: string;
  companyName: string | null;
  number: string | null;
  status: TargetStatus;
  legSid?: string;
  recordId?: string;
  reason?: string;
};

export type DialMode = 'power' | 'parallel';

export type Session = {
  id: string;
  workspaceMemberId: string;
  repName: string;
  callerId: string;
  ringTo: string;
  mode: DialMode;
  lines: number;
  targets: SessionTarget[];
  cursor: number;
  results: TargetResult[];
  batch: { number: number; legSids: string[] } | null;
  batchCount: number;
  repCallSid: string | null;
  paused: boolean;
  state: 'active' | 'ended';
  endReason?: string;
  dialedNumbers: string[];
  seenDroppedLegs: string[];
  createdAt: string;
  lastAdvanceAt?: string;
};

export type RepLegStatus = 'ringing' | 'joined' | 'ended';
export type RepLeg = { sessionId: string; status: RepLegStatus; endReason?: string };

export type Leg = {
  callSid: string;
  sessionId: string;
  batchNumber: number;
  index: number;
  status: TargetStatus;
  // Who this line is calling (copied so updates don't depend on the session).
  personId: string | null;
  companyId: string | null;
  queueItemId: string | null;
  name: string;
  companyName: string | null;
  number: string;
  answeredBy?: string;
  recordId?: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
};

export const sessionKey = (id: string) => `session:${id}`;
const repLegKey = (id: string) => `session-rep:${id}`;
const repCallKey = (callSid: string) => `session-rep-call:${callSid}`;
const legKey = (callSid: string) => `leg:${callSid}`;
const repSessionKey = (workspaceMemberId: string) => `rep-session:${workspaceMemberId}`;
export const claimKey = (sessionId: string, batchNumber: number) =>
  `claim:${sessionId}:${batchNumber}`;

// A session nobody has looked at for this long is treated as over.
const SESSION_STALE_MS = 6 * 60 * 60 * 1000;

export const getSession = (id: string) => kv.get<Session>(sessionKey(id));
export const saveSession = (session: Session) => kv.set(sessionKey(session.id), session);

export const isSessionActive = (session: Session | null, now = Date.now()): session is Session =>
  Boolean(session) &&
  session!.state === 'active' &&
  now - Date.parse(session!.lastAdvanceAt ?? session!.createdAt) < SESSION_STALE_MS;

export const setRepSession = (workspaceMemberId: string, sessionId: string | null) =>
  sessionId
    ? kv.set(repSessionKey(workspaceMemberId), sessionId)
    : kv.delete(repSessionKey(workspaceMemberId));

// The rep's running session, if there is one.
export const getRepSession = async (workspaceMemberId: string): Promise<Session | null> => {
  const id = await kv.get<string>(repSessionKey(workspaceMemberId));
  if (!id) {
    return null;
  }
  const session = await getSession(id);
  return isSessionActive(session) ? session : null;
};

export const getRepSessionId = async (workspaceMemberId: string) =>
  (await getRepSession(workspaceMemberId))?.id ?? null;

export const getRepLeg = (sessionId: string) => kv.get<RepLeg>(repLegKey(sessionId));
export const saveRepLeg = (leg: RepLeg) => kv.set(repLegKey(leg.sessionId), leg);

export const linkRepCall = (callSid: string, sessionId: string) =>
  kv.set(repCallKey(callSid), sessionId);
export const sessionIdForRepCall = (callSid: string) => kv.get<string>(repCallKey(callSid));

export const getLeg = (callSid: string) => kv.get<Leg>(legKey(callSid));
export const saveLeg = (leg: Leg) => kv.set(legKey(leg.callSid), leg);
export const updateLeg = async (callSid: string, changes: Partial<Leg>) => {
  const leg = await getLeg(callSid);
  if (!leg) {
    return null;
  }
  const updated = { ...leg, ...changes };
  await saveLeg(updated);
  return updated;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "First person to pick up wins." Two answers can arrive at the same moment,
// so each one writes its claim, waits a beat, and reads it back: whoever's
// claim is still there gets connected; the other is let go.
export const claimConnection = async (
  sessionId: string,
  batchNumber: number,
  callSid: string,
  settleMs = 400,
): Promise<boolean> => {
  const key = claimKey(sessionId, batchNumber);
  const existing = await kv.get<string>(key);
  if (existing && existing !== callSid) {
    return false;
  }
  await kv.set(key, callSid);
  await sleep(settleMs);
  return (await kv.get<string>(key)) === callSid;
};

export const getClaim = (sessionId: string, batchNumber: number) =>
  kv.get<string>(claimKey(sessionId, batchNumber));

// The rep's latest session, running or just finished (for the summary).
export const getRepLatestSession = async (workspaceMemberId: string): Promise<Session | null> => {
  const id = await kv.get<string>(repSessionKey(workspaceMemberId));
  return id ? getSession(id) : null;
};

// Only one status check works on a session at a time (e.g. two open tabs).
const lockKey = (sessionId: string) => `session-lock:${sessionId}`;
const LOCK_MS = 20_000;

export const tryLockSession = async (sessionId: string, token: string): Promise<boolean> => {
  const current = await kv.get<{ token: string; at: number }>(lockKey(sessionId));
  if (current && current.token !== token && Date.now() - current.at < LOCK_MS) {
    return false;
  }
  await kv.set(lockKey(sessionId), { token, at: Date.now() });
  await sleep(50);
  return (await kv.get<{ token: string }>(lockKey(sessionId)))?.token === token;
};

export const unlockSession = (sessionId: string) => kv.delete(lockKey(sessionId));
