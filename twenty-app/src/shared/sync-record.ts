import type { StoredCall } from 'src/shared/call-store';
import { callResultForEndReason } from 'src/shared/call-results';
import { updateRecord } from 'src/shared/twenty-api';

// Copies what happened on the phone line onto the call's Dialer Call record.
// Runs as the app itself, because Twilio's updates arrive with no user signed in.
export const syncCallResult = async (call: StoredCall | null) => {
  if (!call?.loggedRecordId) {
    return;
  }
  const wasConnected = Boolean(call.connectedAt);
  const data: Record<string, unknown> =
    call.stage === 'ended'
      ? {
          callResult: callResultForEndReason(call.endReason, wasConnected),
          durationSeconds: call.durationSeconds ?? 0,
        }
      : { callResult: wasConnected ? 'CONNECTED' : 'IN_PROGRESS' };
  try {
    await updateRecord('dialerCalls', call.loggedRecordId, data, 'application');
  } catch {
    // Not fatal; the next update or the rep's save will fill it in.
  }
};
