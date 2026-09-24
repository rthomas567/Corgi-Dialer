import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import { MY_CALL_FUNCTION_ID, ROUTE_MY_CALL } from 'src/constants/universal-identifiers';
import { callNeedsOutcome, getRepLatestCall, isCallActive } from 'src/shared/call-store';
import { getRecord } from 'src/shared/twenty-api';

type Person = { id: string; name?: { firstName?: string; lastName?: string } | null };

// The dialer asks this when it opens: "does this rep have a call in progress,
// or a finished call that still needs an outcome?"
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  const workspaceMemberId = context.workspaceMemberId;
  if (!workspaceMemberId) {
    return { ok: false as const, message: 'Not signed in.' };
  }

  const call = await getRepLatestCall(workspaceMemberId);
  const needsOutcome = callNeedsOutcome(call);
  const isActive = isCallActive(call);
  if (!call || (!needsOutcome && !isActive)) {
    return { ok: true as const, call: null };
  }

  const person = await getRecord<Person>('people', call.personId).catch(() => null);
  const personName =
    [person?.name?.firstName, person?.name?.lastName].filter(Boolean).join(' ') ||
    'this person';

  return {
    ok: true as const,
    call: {
      callSid: call.callSid,
      personId: call.personId,
      personName,
      personFirstName: person?.name?.firstName?.trim() || personName,
      stage: call.stage,
      endReason: call.endReason ?? null,
      durationSeconds: call.durationSeconds ?? null,
      needsOutcome,
      isActive,
    },
  };
};

export default defineLogicFunction({
  universalIdentifier: MY_CALL_FUNCTION_ID,
  name: 'dialer-my-call',
  description: "Returns the rep's call in progress, or the last call still waiting for an outcome.",
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_MY_CALL,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
