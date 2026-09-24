import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  HANG_UP_FUNCTION_ID,
  ROUTE_HANG_UP,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import { readJsonBody } from 'src/shared/route-body';
import { readSignalWireSettings } from 'src/shared/settings';
import { endCall } from 'src/shared/signalwire';
import { syncCallResult } from 'src/shared/sync-record';

const handler = async (
  event: RoutePayload,
  context: LogicFunctionExecutionContext,
) => {
  const { callSid } = readJsonBody<{ callSid: string }>(event);
  const call = callSid ? await getCall(callSid) : null;

  if (!call || call.workspaceMemberId !== context.workspaceMemberId) {
    return { ok: false as const, message: 'Call not found.' };
  }

  const signalWire = readSignalWireSettings();
  if (!signalWire) {
    return { ok: false as const, message: 'SignalWire is not set up.' };
  }

  if (call.stage !== 'ended') {
    try {
      await endCall(signalWire, call.callSid);
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : 'Could not hang up.',
      };
    }
    await syncCallResult(
      await updateCall(call.callSid, {
        stage: 'ended',
        endedAt: new Date().toISOString(),
        endReason: 'hung-up',
      }),
    );
  }

  return { ok: true as const };
};

export default defineLogicFunction({
  universalIdentifier: HANG_UP_FUNCTION_ID,
  name: 'dialer-hang-up',
  description: 'Ends an active call.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_HANG_UP,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
