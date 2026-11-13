import { randomUUID } from 'crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_REP_ANSWERED,
  ROUTE_SESSION_REP_EVENTS,
  ROUTE_SESSION_START,
  SESSION_START_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { callNeedsOutcome, getRepLatestCall, isCallActive } from 'src/shared/call-store';
import { readJsonBody } from 'src/shared/route-body';
import { clampLines } from 'src/shared/session-engine';
import {
  type DialMode,
  getRepSession,
  linkRepCall,
  saveRepLeg,
  saveSession,
  type Session,
  type SessionTarget,
  setRepSession,
  type TargetKind,
} from 'src/shared/session-store';
import { readRepSettings, readTwilioSettings } from 'src/shared/settings';
import { ringRepPhone } from 'src/shared/twilio';
import { functionsBaseUrl, getRecord } from 'src/shared/twenty-api';

export const MAX_SESSION_SIZE = 500;

type WorkspaceMember = {
  id: string;
  userEmail?: string | null;
  name?: { firstName?: string; lastName?: string } | null;
};

const KIND_BY_OBJECT: Record<string, TargetKind> = {
  person: 'person',
  company: 'company',
  callQueueItem: 'queue',
};

const fail = (message: string) => ({ ok: false as const, message });

// "Start dialing" from a list of people, companies, or Call Queue entries.
// Rings the rep's phone first; dialing starts once they pick up.
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  const workspaceMemberId = context.workspaceMemberId;
  if (!workspaceMemberId) {
    return fail('You need to be signed in to Twenty to start dialing.');
  }

  const body = readJsonBody<{ object: string; recordIds: unknown; mode: DialMode; lines: number }>(event);
  const kind = KIND_BY_OBJECT[body.object ?? ''];
  if (!kind) {
    return fail('Start the dialer from People, Companies, or the Call Queue.');
  }
  const ids = Array.isArray(body.recordIds)
    ? [...new Set(body.recordIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  if (ids.length === 0) {
    return fail('Select at least one record to dial.');
  }
  if (ids.length > MAX_SESSION_SIZE) {
    return fail(`Select ${MAX_SESSION_SIZE} records or fewer at a time.`);
  }
  const mode: DialMode = body.mode === 'power' ? 'power' : 'parallel';
  const lines = clampLines(mode, body.lines);

  if (await getRepSession(workspaceMemberId)) {
    return fail('You already have a dialing session running. Open it with "Open dialer".');
  }
  const latest = await getRepLatestCall(workspaceMemberId);
  if (callNeedsOutcome(latest)) {
    return { ...fail('Pick an outcome for your last call before starting.'), needsOutcome: true as const };
  }
  if (isCallActive(latest)) {
    return fail("You're on a call. Hang up first.");
  }

  const twilio = readTwilioSettings();
  if (!twilio) {
    return fail('SignalWire is not set up yet. Ask an admin to fill in the SignalWire settings in Settings > Apps > Corgi Dialer.');
  }
  const member = await getRecord<WorkspaceMember>('workspaceMembers', workspaceMemberId);
  if (!member?.userEmail) {
    return fail('Could not find your Twenty account email.');
  }
  const rep = readRepSettings(member.userEmail);
  if ('error' in rep) {
    return fail(rep.error);
  }

  const sessionId = randomUUID();
  const base = functionsBaseUrl();
  let repCallSid: string;
  try {
    repCallSid = await ringRepPhone(twilio, {
      repPhone: rep.ringTo,
      callerId: rep.callerId,
      bridgeUrl: `${base}${ROUTE_SESSION_REP_ANSWERED}`,
      eventsUrl: `${base}${ROUTE_SESSION_REP_EVENTS}`,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'SignalWire could not ring your phone.');
  }

  const targets: SessionTarget[] = ids.map((id) => ({ kind, id }));
  const session: Session = {
    id: sessionId,
    workspaceMemberId,
    repName:
      [member.name?.firstName, member.name?.lastName].filter(Boolean).join(' ') || member.userEmail,
    callerId: rep.callerId,
    ringTo: rep.ringTo,
    mode,
    lines,
    targets,
    cursor: 0,
    results: [],
    batch: null,
    batchCount: 0,
    repCallSid,
    paused: false,
    state: 'active',
    dialedNumbers: [],
    seenDroppedLegs: [],
    createdAt: new Date().toISOString(),
  };

  await linkRepCall(repCallSid, sessionId);
  await saveRepLeg({ sessionId, status: 'ringing' });
  await saveSession(session);
  await setRepSession(workspaceMemberId, sessionId);

  return { ok: true as const, sessionId };
};

export default defineLogicFunction({
  universalIdentifier: SESSION_START_FUNCTION_ID,
  name: 'dialer-session-start',
  description: 'Starts a power or parallel dialing session for the selected records.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_START,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
