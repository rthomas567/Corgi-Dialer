import { randomUUID } from 'crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_CONTROL,
  SESSION_CONTROL_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { readJsonBody } from 'src/shared/route-body';
import { foldFinishedBatch, hangUpOpenLegs } from 'src/shared/session-engine';
import {
  getLeg,
  getRepLatestSession,
  getSession,
  type Leg,
  saveSession,
  setRepSession,
  tryLockSession,
  unlockSession,
} from 'src/shared/session-store';
import { readTwilioSettings } from 'src/shared/settings';
import { endCall } from 'src/shared/twilio';

type Action = 'pause' | 'resume' | 'stop' | 'hang-up' | 'dismiss' | 'close';
const ACTIONS: Action[] = ['pause', 'resume', 'stop', 'hang-up', 'dismiss', 'close'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Buttons on the dialer screen: Pause, Resume, Stop, Hang up, dismiss a
// "also picked up" notice, and Close once the session is over.
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  const workspaceMemberId = context.workspaceMemberId;
  const { action, callSid } = readJsonBody<{ action: Action; callSid: string }>(event);
  if (!workspaceMemberId || !action || !ACTIONS.includes(action)) {
    return { ok: false as const, message: 'Unknown request.' };
  }

  const found = await getRepLatestSession(workspaceMemberId);
  if (!found || found.workspaceMemberId !== workspaceMemberId) {
    return { ok: false as const, message: 'No dialing session found.' };
  }

  if (action === 'close') {
    if (found.state === 'active') {
      return { ok: false as const, message: 'Stop the session before closing it.' };
    }
    await setRepSession(workspaceMemberId, null);
    return { ok: true as const };
  }

  const twilio = readTwilioSettings();
  if (!twilio) {
    return { ok: false as const, message: 'SignalWire is not set up.' };
  }

  // Wait for any status check that is busy with this session.
  const token = randomUUID();
  let locked = false;
  for (let attempt = 0; attempt < 30 && !locked; attempt += 1) {
    locked = await tryLockSession(found.id, token);
    if (!locked) await sleep(200);
  }
  if (!locked) {
    return { ok: false as const, message: 'The dialer is busy. Try again in a moment.' };
  }

  try {
    const session = (await getSession(found.id)) ?? found;
    const legs = session.batch
      ? (await Promise.all(session.batch.legSids.map((sid) => getLeg(sid)))).filter(
          (leg): leg is Leg => Boolean(leg),
        )
      : [];

    switch (action) {
      case 'pause':
      case 'resume':
        await saveSession({ ...session, paused: action === 'pause' });
        return { ok: true as const };

      case 'dismiss':
        if (callSid && !session.seenDroppedLegs.includes(callSid)) {
          await saveSession({ ...session, seenDroppedLegs: [...session.seenDroppedLegs, callSid] });
        }
        return { ok: true as const };

      case 'hang-up': {
        const connected = legs.find((leg) => leg.status === 'connected');
        if (!connected) {
          return { ok: false as const, message: "You're not on a call right now." };
        }
        await endCall(twilio, connected.callSid);
        return { ok: true as const };
      }

      case 'stop': {
        await hangUpOpenLegs(twilio, legs);
        if (session.repCallSid) {
          // Ending the rep's line also ends any call they were on.
          await endCall(twilio, session.repCallSid).catch(() => undefined);
        }
        await saveSession(
          foldFinishedBatch({ ...session, state: 'ended', endReason: 'stopped' }, legs),
        );
        return { ok: true as const };
      }
    }
  } finally {
    await unlockSession(found.id);
  }
};

export default defineLogicFunction({
  universalIdentifier: SESSION_CONTROL_FUNCTION_ID,
  name: 'dialer-session-control',
  description: 'Pause, resume, stop, or hang up in a dialing session.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_CONTROL,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
