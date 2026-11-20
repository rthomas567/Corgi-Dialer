import {
  ROUTE_SESSION_LEG_ANSWERED,
  ROUTE_SESSION_LEG_EVENTS,
} from 'src/constants/universal-identifiers';
import { callNeedsOutcome, getRepLatestCall, type StoredCall } from 'src/shared/call-store';
import {
  getLeg,
  getRepLeg,
  type Leg,
  type RepLeg,
  saveLeg,
  saveSession,
  type Session,
  type TargetResult,
  type TargetStatus,
} from 'src/shared/session-store';
import type { TwilioSettings } from 'src/shared/settings';
import { resolveTarget } from 'src/shared/targets';
import { dialProspect, endCall } from 'src/shared/twilio';
import { escapeXml } from 'src/shared/twiml';
import { createRecord, functionsBaseUrl, updateRecord } from 'src/shared/twenty-api';

export const MAX_LINES = 5;
// How many list entries one status check may look through while skipping
// DNC / no-number entries, so each check stays quick.
const MAX_LOOKUPS_PER_CHECK = 25;

const FINAL_STATUSES: TargetStatus[] = [
  'voicemail', 'no-answer', 'busy', 'failed', 'dropped', 'canceled', 'done',
  'skipped-dnc', 'skipped-no-number', 'skipped-duplicate',
];

export const isFinalStatus = (status: TargetStatus) => FINAL_STATUSES.includes(status);

export const clampLines = (mode: 'power' | 'parallel', lines: unknown) => {
  if (mode === 'power') return 1;
  const value = Math.round(Number(lines));
  if (!Number.isFinite(value)) return MAX_LINES;
  return Math.min(MAX_LINES, Math.max(2, value));
};

// Twilio's AnsweredBy: "human", "unknown", "machine_start",
// "machine_end_beep", "machine_end_silence", "machine_end_other", "fax".
export const isMachineAnswer = (answeredBy: string | undefined) =>
  Boolean(answeredBy) && (answeredBy!.startsWith('machine') || answeredBy === 'fax');

// What a finished line's Twilio status means for us.
export const finalStatusFromTwilio = (callStatus: string): TargetStatus => {
  switch (callStatus) {
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no-answer';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return 'done';
  }
};

// The "Call result" saved on the Dialer Call record.
export const callResultForStatus = (status: TargetStatus): string => {
  switch (status) {
    case 'connected':
    case 'done':
      return 'CONNECTED';
    case 'voicemail':
      return 'VOICEMAIL';
    case 'no-answer':
      return 'NO_ANSWER';
    case 'busy':
      return 'BUSY';
    case 'failed':
      return 'FAILED';
    case 'dropped':
      return 'DROPPED';
    case 'canceled':
      return 'CANCELED';
    default:
      return 'IN_PROGRESS';
  }
};

// Call Queue status after an attempt that the rep didn't talk through.
export const queueStatusForResult = (status: TargetStatus): string | null => {
  switch (status) {
    case 'skipped-dnc':
      return 'SKIPPED_DNC';
    case 'skipped-no-number':
      return 'NO_NUMBER';
    case 'voicemail':
    case 'no-answer':
    case 'busy':
    case 'failed':
    case 'dropped':
      return 'CALLED';
    default:
      return null;
  }
};

export const conferenceName = (sessionId: string) => `corgi-dialer-${sessionId}`;

// First thing the rep hears: press 1 to start. Up to three tries, then hang up.
export const repConfirmTwiml = (confirmUrl: string, isRetry: boolean) =>
  `<Gather numDigits="1" timeout="8" action="${escapeXml(confirmUrl)}" method="POST">` +
  `<Say>${isRetry ? 'Please press 1.' : 'Corgi dialer. Press 1 to start dialing.'}</Say></Gather>` +
  `<Gather numDigits="1" timeout="8" action="${escapeXml(confirmUrl)}" method="POST">` +
  `<Say>Press 1 to start dialing.</Say></Gather>` +
  `<Say>No key pressed. Goodbye.</Say><Hangup/>`;

// What the rep's phone does once they press 1: wait on an open line.
// When the rep hangs up, the whole session's line closes.
export const repJoinTwiml = (sessionId: string) =>
  `<Say>You're on the Corgi dialer. Calls are starting now.</Say>` +
  `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" waitUrl="">` +
  `${escapeXml(conferenceName(sessionId))}</Conference></Dial>`;

// What a prospect who picked up hears: the recording notice, then the rep.
export const prospectJoinTwiml = (sessionId: string, announcement: string) =>
  (announcement ? `<Say>${escapeXml(announcement)}</Say>` : '') +
  `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false" waitUrl="">` +
  `${escapeXml(conferenceName(sessionId))}</Conference></Dial>`;

// --- The regular check-in from the rep's screen ----------------------------

export type SessionDeps = {
  twilio: TwilioSettings;
  now?: () => Date;
};

const loadBatchLegs = async (session: Session): Promise<Leg[]> => {
  if (!session.batch) return [];
  const legs = await Promise.all(session.batch.legSids.map((sid) => getLeg(sid)));
  return legs.filter((leg): leg is Leg => Boolean(leg));
};

// Hang up every line still ringing in this session.
export const hangUpOpenLegs = async (twilio: TwilioSettings, legs: Leg[], exceptSid?: string) => {
  await Promise.allSettled(
    legs
      .filter((leg) => leg.callSid !== exceptSid && !isFinalStatus(leg.status) && leg.status !== 'connected')
      .map((leg) => endCall(twilio, leg.callSid)),
  );
};

// Copies finished lines into the session's results. Lines that were hung up
// because someone else picked up go back on the list once.
export const foldFinishedBatch = (session: Session, legs: Leg[]): Session => {
  const results = [...session.results];
  const targets = [...session.targets];
  const claimWinner = legs.find((leg) => leg.status === 'done' || leg.status === 'connected');

  for (const leg of legs) {
    const position = results.findIndex((result) => result.legSid === leg.callSid);
    if (position === -1) continue;
    const status = leg.status === 'connected' ? 'done' : leg.status;
    results[position] = { ...results[position], status };

    const target = targets[results[position].index];
    const wasCutShort = status === 'canceled' && Boolean(claimWinner) && !leg.answeredBy;
    if (wasCutShort && target && !target.retried) {
      targets.push({ ...target, retried: true });
    }
  }
  return { ...session, results, targets, batch: null };
};

const dialOne = async (
  session: Session,
  result: TargetResult,
  batchNumber: number,
  deps: SessionDeps,
): Promise<TargetResult> => {
  const base = functionsBaseUrl();
  const nowIso = (deps.now?.() ?? new Date()).toISOString();

  let callSid: string;
  try {
    callSid = await dialProspect(deps.twilio, {
      to: result.number!,
      callerId: session.callerId,
      answeredUrl: `${base}${ROUTE_SESSION_LEG_ANSWERED}`,
      eventsUrl: `${base}${ROUTE_SESSION_LEG_EVENTS}`,
    });
  } catch (error) {
    return {
      ...result,
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Twilio could not place the call.',
    };
  }

  // Log the attempt right away (as the rep), so every dial shows up in Twenty.
  let recordId: string | undefined;
  try {
    const record = await createRecord<{ id: string }>('dialerCalls', {
      name: `${result.name} (${session.mode === 'parallel' ? 'parallel' : 'power'} dial)`,
      rep: session.repName,
      callResult: 'IN_PROGRESS',
      phoneNumber: result.number,
      calledAt: nowIso,
      signalWireCallId: callSid,
      personId: result.personId,
      companyId: result.companyId,
    });
    recordId = record?.id;
  } catch {
    // Not fatal; the call is already ringing.
  }

  await saveLeg({
    callSid,
    sessionId: session.id,
    batchNumber,
    index: result.index,
    status: 'dialing',
    personId: result.personId,
    companyId: result.companyId,
    queueItemId: result.queueItemId,
    name: result.name,
    companyName: result.companyName,
    number: result.number!,
    recordId,
  });

  return { ...result, legSid: callSid, recordId };
};

const updateQueueItem = async (result: TargetResult) => {
  const status = queueStatusForResult(result.status);
  if (!result.queueItemId || !status) return;
  await updateRecord('callQueueItems', result.queueItemId, {
    status,
    lastResult: result.reason ?? callResultForStatus(result.status),
    lastCalledAt: new Date().toISOString(),
  }).catch(() => undefined);
};

// Picks the next people on the list, skipping anyone Do Not Call, without a
// number, or already dialed this session, and dials them all at once.
const dialNextBatch = async (session: Session, deps: SessionDeps): Promise<Session> => {
  const picked: TargetResult[] = [];
  const skipped: TargetResult[] = [];
  const dialedNumbers = new Set(session.dialedNumbers);
  let cursor = session.cursor;
  let lookups = 0;

  while (picked.length < session.lines && cursor < session.targets.length && lookups < MAX_LOOKUPS_PER_CHECK) {
    // Look up the next few entries at the same time to keep things quick.
    const want = Math.min(session.lines - picked.length, MAX_LOOKUPS_PER_CHECK - lookups);
    const chunk = session.targets.slice(cursor, cursor + want).map((target, offset) => ({
      target,
      index: cursor + offset,
    }));
    cursor += chunk.length;
    lookups += chunk.length;

    const resolved = await Promise.all(
      chunk.map(async ({ target, index }): Promise<TargetResult> => {
        try {
          return await resolveTarget(target, index);
        } catch {
          // If we can't confirm it's safe to call, we don't call.
          return {
            index, kind: target.kind, id: target.id, personId: null, companyId: null,
            queueItemId: target.kind === 'queue' ? target.id : null, name: 'Unknown',
            companyName: null, number: null, status: 'skipped-dnc',
            reason: 'Could not confirm this entry is OK to call, so it was skipped.',
          };
        }
      }),
    );

    for (let result of resolved) {
      if (result.status === 'dialing' && result.number && dialedNumbers.has(result.number)) {
        result = { ...result, status: 'skipped-duplicate', reason: 'Number already dialed this session.' };
      }
      if (result.status === 'dialing') {
        dialedNumbers.add(result.number!);
        picked.push(result);
      } else {
        skipped.push(result);
      }
    }
  }

  await Promise.all(skipped.map(updateQueueItem));

  const batchNumber = session.batchCount + 1;
  const dialed = await Promise.all(picked.map((result) => dialOne(session, result, batchNumber, deps)));
  const failed = dialed.filter((result) => !result.legSid);
  await Promise.all(failed.map(updateQueueItem));
  const legSids = dialed.map((result) => result.legSid).filter((sid): sid is string => Boolean(sid));

  return {
    ...session,
    cursor,
    dialedNumbers: [...dialedNumbers],
    results: [...session.results, ...skipped, ...dialed],
    batch: legSids.length > 0 ? { number: batchNumber, legSids } : null,
    batchCount: legSids.length > 0 ? batchNumber : session.batchCount,
  };
};

export type AdvanceResult = {
  session: Session;
  repLeg: RepLeg | null;
  legs: Leg[];
  latestCall: StoredCall | null;
};

// Called every couple of seconds while the rep's dialer is open. Decides
// whether to dial the next batch. Because only the rep's own screen does this,
// two batches can never start at once.
export const advanceSession = async (
  initial: Session,
  deps: SessionDeps,
): Promise<AdvanceResult> => {
  let session: Session = { ...initial, lastAdvanceAt: (deps.now?.() ?? new Date()).toISOString() };
  const repLeg = await getRepLeg(session.id);
  let legs = await loadBatchLegs(session);
  const latestCall = await getRepLatestCall(session.workspaceMemberId);

  // The rep hung up their phone (or never answered): the session is over.
  if (repLeg?.status === 'ended') {
    await hangUpOpenLegs(deps.twilio, legs);
    session = foldFinishedBatch(
      { ...session, state: 'ended', endReason: repLeg.endReason ?? 'rep-hung-up' },
      legs,
    );
    await saveSession(session);
    return { session, repLeg, legs, latestCall };
  }

  if (repLeg?.status !== 'joined') {
    await saveSession(session);
    return { session, repLeg, legs, latestCall };
  }

  const someoneOnTheLine = legs.some((leg) => leg.status === 'connected');
  const waitingOnOutcome = callNeedsOutcome(latestCall);
  const stillRinging = legs.some((leg) => !isFinalStatus(leg.status) && leg.status !== 'connected');

  if (session.batch && !someoneOnTheLine && !stillRinging) {
    const batchSids = new Set(session.batch.legSids);
    session = foldFinishedBatch(session, legs);
    legs = [];
    await Promise.all(
      session.results.filter((r) => r.legSid && batchSids.has(r.legSid)).map(updateQueueItem),
    );
  }

  const readyToDial =
    !session.batch && !session.paused && !waitingOnOutcome && session.state === 'active';

  if (readyToDial) {
    if (session.cursor < session.targets.length) {
      session = await dialNextBatch(session, deps);
      legs = await loadBatchLegs(session);
    } else {
      session = { ...session, state: 'ended', endReason: 'list-finished' };
      if (session.repCallSid) {
        await endCall(deps.twilio, session.repCallSid).catch(() => undefined);
      }
    }
  }

  await saveSession(session);
  return { session, repLeg, legs, latestCall };
};

// --- What the rep's screen shows -------------------------------------------

export type SessionView = {
  id: string;
  mode: Session['mode'];
  lines: number;
  state: Session['state'];
  endReason: string | null;
  paused: boolean;
  repStatus: RepLeg['status'] | 'unknown';
  total: number;
  position: number;
  activeLines: Array<{
    callSid: string;
    name: string;
    companyName: string | null;
    number: string | null;
    status: TargetStatus;
    personId: string | null;
    companyId: string | null;
  }>;
  connected: null | {
    callSid: string;
    name: string;
    companyName: string | null;
    number: string | null;
    connectedAt: string | null;
    personId: string | null;
    companyId: string | null;
  };
  needsOutcome: null | { callSid: string; name: string; isDnc?: boolean };
  dropped: Array<{
    callSid: string;
    name: string;
    companyName: string | null;
    number: string | null;
    personId: string | null;
    companyId: string | null;
  }>;
  counts: Record<'connected' | 'voicemail' | 'noAnswer' | 'skippedDnc' | 'noNumber' | 'dropped', number>;
};

export const buildView = (result: AdvanceResult): SessionView => {
  const { session, repLeg, legs, latestCall } = result;
  const byLeg = new Map(session.results.filter((r) => r.legSid).map((r) => [r.legSid!, r]));
  const liveStatus = new Map(legs.map((leg) => [leg.callSid, leg.status]));
  const statusOf = (r: TargetResult) => (r.legSid && liveStatus.get(r.legSid)) || r.status;

  const counts = { connected: 0, voicemail: 0, noAnswer: 0, skippedDnc: 0, noNumber: 0, dropped: 0 };
  for (const r of session.results) {
    const status = statusOf(r);
    if (status === 'done' || status === 'connected') counts.connected += 1;
    else if (status === 'voicemail') counts.voicemail += 1;
    else if (status === 'no-answer' || status === 'busy' || status === 'canceled') counts.noAnswer += 1;
    else if (status === 'skipped-dnc') counts.skippedDnc += 1;
    else if (status === 'skipped-no-number' || status === 'failed') counts.noNumber += 1;
    else if (status === 'dropped') counts.dropped += 1;
  }

  const connectedLeg = legs.find((leg) => leg.status === 'connected');

  const dropped = session.results
    .filter((r) => r.legSid && statusOf(r) === 'dropped' && !session.seenDroppedLegs.includes(r.legSid))
    .map((r) => ({
      callSid: r.legSid!, name: r.name, companyName: r.companyName, number: r.number,
      personId: r.personId, companyId: r.companyId,
    }));

  const needsOutcome =
    latestCall && callNeedsOutcome(latestCall) && latestCall.sessionId === session.id
      ? { callSid: latestCall.callSid, name: latestCall.displayName ?? 'this call' }
      : null;

  return {
    id: session.id,
    mode: session.mode,
    lines: session.lines,
    state: session.state,
    endReason: session.endReason ?? null,
    paused: session.paused,
    repStatus: repLeg?.status ?? 'unknown',
    total: session.targets.length,
    position: Math.min(session.cursor, session.targets.length),
    activeLines: legs.map((leg) => ({
      callSid: leg.callSid,
      name: leg.name,
      companyName: leg.companyName,
      number: leg.number,
      status: leg.status,
      personId: leg.personId,
      companyId: leg.companyId,
    })),
    connected: connectedLeg
      ? {
          callSid: connectedLeg.callSid,
          name: connectedLeg.name,
          companyName: connectedLeg.companyName,
          number: connectedLeg.number,
          connectedAt: connectedLeg.connectedAt ?? null,
          personId: connectedLeg.personId,
          companyId: connectedLeg.companyId,
        }
      : null,
    needsOutcome,
    dropped,
    counts,
  };
};
