import { randomUUID } from 'crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  ROUTE_SESSION_STATUS,
  SESSION_STATUS_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { getRepLatestCall } from 'src/shared/call-store';
import { advanceSession, buildView } from 'src/shared/session-engine';
import {
  getLeg,
  getRepLatestSession,
  getRepLeg,
  isSessionActive,
  type Leg,
  tryLockSession,
  unlockSession,
} from 'src/shared/session-store';
import { readTwilioSettings } from 'src/shared/settings';

// The dialer screen asks this every couple of seconds. Besides reporting
// what's happening, it is what moves the session along (dials the next
// batch), so dialing only happens while the rep has the dialer open.
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  const workspaceMemberId = context.workspaceMemberId;
  if (!workspaceMemberId) {
    return { ok: false as const, message: 'Not signed in.' };
  }

  const session = await getRepLatestSession(workspaceMemberId);
  if (!session) {
    return { ok: true as const, session: null };
  }

  const twilio = readTwilioSettings();
  const token = randomUUID();

  if (twilio && isSessionActive(session) && (await tryLockSession(session.id, token))) {
    try {
      const result = await advanceSession(session, { twilio });
      return { ok: true as const, session: buildView(result) };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : 'The dialer hit a problem.',
      };
    } finally {
      await unlockSession(session.id);
    }
  }

  // Finished session, or another tab is busy moving it along: just report.
  const legs = session.batch
    ? (await Promise.all(session.batch.legSids.map((sid) => getLeg(sid)))).filter(
        (leg): leg is Leg => Boolean(leg),
      )
    : [];
  return {
    ok: true as const,
    session: buildView({
      session,
      legs,
      repLeg: await getRepLeg(session.id),
      latestCall: await getRepLatestCall(workspaceMemberId),
    }),
  };
};

export default defineLogicFunction({
  universalIdentifier: SESSION_STATUS_FUNCTION_ID,
  name: 'dialer-session-status',
  description: 'Reports the dialing session to the rep and dials the next batch when ready.',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SESSION_STATUS,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
