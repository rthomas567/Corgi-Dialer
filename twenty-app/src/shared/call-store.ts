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
