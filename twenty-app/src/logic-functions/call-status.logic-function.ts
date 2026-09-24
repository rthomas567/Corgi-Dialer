import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  CALL_STATUS_FUNCTION_ID,
  ROUTE_CALL_STATUS,
} from 'src/constants/universal-identifiers';
import { getCall } from 'src/shared/call-store';

// The dialer panel asks this every couple of seconds: "where is my call at?"
const handler = async (
  event: RoutePayload,
  context: LogicFunctionExecutionContext,
) => {
  const callSid = event.queryStringParameters?.callSid;
  if (!callSid) {
    return { ok: false as const, message: 'Missing call ID.' };
  }

  const call = await getCall(callSid);
  if (!call || call.workspaceMemberId !== context.workspaceMemberId) {
    return { ok: false as const, message: 'Call not found.' };
  }

  return {
    ok: true as const,
    stage: call.stage,
    endReason: call.endReason ?? null,
    connectedAt: call.connectedAt ?? null,
    durationSeconds: call.durationSeconds ?? null,
  };
};

export default defineLogicFunction({
  universalIdentifier: CALL_STATUS_FUNCTION_ID,
  name: 'dialer-call-status',
  description: 'Returns the live status of a call to the dialer panel.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_CALL_STATUS,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
