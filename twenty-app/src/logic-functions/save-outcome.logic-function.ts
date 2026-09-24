import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  ROUTE_SAVE_OUTCOME,
  SAVE_OUTCOME_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import {
  type CompanyRecord,
  DNC_LEAD_STATUS,
  DNC_OUTCOME,
  isCalendarDate,
} from 'src/shared/dnc';
import { isCallOutcome, outcomeLabel } from 'src/shared/outcomes';
import { readJsonBody } from 'src/shared/route-body';
import { createRecord, getRecord, updateRecord } from 'src/shared/twenty-api';

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
  companyId?: string | null;
};

const MAX_NOTES_LENGTH = 5000;

// Saves the rep's chosen outcome (and notes) as a Dialer Call record,
// linked to the person and their company. Saving again updates the same record.
const handler = async (
  event: RoutePayload,
  context: LogicFunctionExecutionContext,
) => {
  const { callSid, outcome, notes, localDate } = readJsonBody<{
    callSid: string;
    outcome: string;
    notes: string;
    localDate: string;
  }>(event);

  if (!isCallOutcome(outcome)) {
    return { ok: false as const, message: 'Pick an outcome first.' };
  }

  const call = callSid ? await getCall(callSid) : null;
  if (!call || call.workspaceMemberId !== context.workspaceMemberId) {
    return { ok: false as const, message: 'Call not found.' };
  }

  const person = await getRecord<Person>('people', call.personId);
  const fullName =
    [person?.name?.firstName, person?.name?.lastName].filter(Boolean).join(' ') ||
    'Unknown person';

  const cleanNotes =
    typeof notes === 'string' ? notes.trim().slice(0, MAX_NOTES_LENGTH) : '';

  const data = {
    name: `${fullName} (${outcomeLabel(outcome)})`,
    outcome,
    notes: cleanNotes,
    durationSeconds: call.durationSeconds ?? 0,
    phoneNumber: call.prospectNumber,
    calledAt: call.createdAt,
    signalWireCallId: call.callSid,
    personId: call.personId,
    companyId: person?.companyId ?? null,
  };

  let recordId: string;
  try {
    if (call.loggedRecordId) {
      await updateRecord('dialerCalls', call.loggedRecordId, data);
      recordId = call.loggedRecordId;
    } else {
      const created = await createRecord<{ id: string }>('dialerCalls', data);
      if (!created?.id) {
        return { ok: false as const, message: 'Twenty did not confirm the save. Try again.' };
      }
      recordId = created.id;
      await updateCall(call.callSid, { loggedRecordId: created.id });
    }
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? `Could not save the call: ${error.message}`
          : 'Could not save the call.',
    };
  }

  // The call is saved. Now update the company. Problems here don't undo the
  // save; they come back as a warning the rep can act on.
  const warnings: string[] = [];
  const isDnc = outcome === DNC_OUTCOME;
  let companyMarkedDnc = false;
  const companyId = person?.companyId ?? null;

  if (companyId) {
    const company = await getRecord<CompanyRecord>('companies', companyId).catch(() => null);
    const callDate = isCalendarDate(localDate) ? localDate : call.createdAt.slice(0, 10);

    // 1. Last Contacted: only ever move it forward.
    const companyChanges: Record<string, unknown> = {};
    if (!company?.lastContacted || company.lastContacted.slice(0, 10) < callDate) {
      companyChanges.lastContacted = callDate;
    }
    // 2. Do Not Call switch.
    if (isDnc) {
      companyChanges.dnc = true;
    }
    if (Object.keys(companyChanges).length > 0) {
      try {
        await updateRecord('companies', companyId, companyChanges);
        companyMarkedDnc = isDnc;
      } catch {
        warnings.push(
          isDnc
            ? 'The call was saved, but the company could not be marked Do Not Call. Turn on its DNC switch by hand.'
            : 'The call was saved, but the company\'s Last Contacted date could not be updated.',
        );
      }
    }
    // 3. Lead Status = DNC (separate, so the DNC switch still sticks if this fails).
    if (isDnc) {
      try {
        await updateRecord('companies', companyId, { leadStatus: DNC_LEAD_STATUS });
      } catch {
        warnings.push('The company is blocked from calls, but its Lead Status could not be set to DNC.');
      }
    }
  } else if (isDnc) {
    warnings.push(
      'This person has no company, so only this person is blocked from calls. Link them to a company to block the whole company.',
    );
  }

  return {
    ok: true as const,
    recordId,
    companyMarkedDnc,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_OUTCOME_FUNCTION_ID,
  name: 'dialer-save-outcome',
  description: 'Saves the call outcome and notes to Twenty.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_SAVE_OUTCOME,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
