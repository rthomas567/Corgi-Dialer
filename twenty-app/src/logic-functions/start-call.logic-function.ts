import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  ROUTE_BRIDGE,
  ROUTE_CALL_EVENTS,
  ROUTE_START_CALL,
  START_CALL_FUNCTION_ID,
} from 'src/constants/universal-identifiers';
import {
  callNeedsOutcome,
  getRepLatestCall,
  isCallActive,
  saveCall,
  setRepLatestCall,
} from 'src/shared/call-store';
import { getDoNotCallStatus } from 'src/shared/dnc';
import { firstDialableNumber, type TwentyPhones } from 'src/shared/phone';
import { getRepSessionId } from 'src/shared/session-store';
import { readJsonBody } from 'src/shared/route-body';
import { readRepSettings, readTwilioSettings } from 'src/shared/settings';
import { ringRepPhone } from 'src/shared/twilio';
import { createRecord, functionsBaseUrl, getRecord } from 'src/shared/twenty-api';

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
  phones?: TwentyPhones;
  mobilePhone?: TwentyPhones;
  companyId?: string | null;
};
type WorkspaceMember = {
  id: string;
  userEmail?: string | null;
  name?: { firstName?: string; lastName?: string } | null;
};

const fail = (message: string) => ({ ok: false as const, message });

const handler = async (
  event: RoutePayload,
  context: LogicFunctionExecutionContext,
) => {
  const workspaceMemberId = context.workspaceMemberId;
  if (!workspaceMemberId) {
    return fail('You need to be signed in to Twenty to place a call.');
  }

  // One call at a time, and every answered call needs an outcome before the next.
  const latest = await getRepLatestCall(workspaceMemberId);
  if (callNeedsOutcome(latest)) {
    return {
      ok: false as const,
      needsOutcome: true as const,
      message: 'Pick an outcome for your last call before starting a new one.',
    };
  }
  if (isCallActive(latest)) {
    return fail("You're already on a call. Hang up that call first.");
  }
  if (await getRepSessionId(workspaceMemberId)) {
    return fail('You have a power dialer session running. Stop it before calling one person.');
  }

  const { personId } = readJsonBody<{ personId: string }>(event);
  if (!personId) {
    return fail('No person was selected.');
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

  const person = await getRecord<Person>('people', personId);
  if (!person) {
    return fail('Could not load this person.');
  }

  const prospectNumber = firstDialableNumber(person.phones, person.mobilePhone);

  // Never dial anyone marked Do Not Call, even if the panel was already open.
  const dncStatus = await getDoNotCallStatus(personId, prospectNumber);
  if (dncStatus.doNotCall) {
    return fail(dncStatus.reason ?? 'This person is marked Do Not Call.');
  }

  if (!prospectNumber) {
    return fail('This person has no usable phone number.');
  }

  const baseUrl = functionsBaseUrl();

  let callSid: string;
  try {
    callSid = await ringRepPhone(twilio, {
      repPhone: rep.ringTo,
      callerId: rep.callerId,
      bridgeUrl: `${baseUrl}${ROUTE_BRIDGE}`,
      eventsUrl: `${baseUrl}${ROUTE_CALL_EVENTS}`,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'SignalWire could not start the call.');
  }

  const createdAt = new Date().toISOString();
  const repName =
    [member.name?.firstName, member.name?.lastName].filter(Boolean).join(' ') ||
    member.userEmail;
  const personName =
    [person.name?.firstName, person.name?.lastName].filter(Boolean).join(' ') ||
    'Unknown person';

  // Create the Dialer Call record now (as the rep, so "Created by" is the rep).
  // The phone line result and the recording get filled in as they arrive,
  // even if the rep never picks an outcome.
  let loggedRecordId: string | undefined;
  try {
    const record = await createRecord<{ id: string }>('dialerCalls', {
      name: `${personName} (call)`,
      rep: repName,
      callResult: 'IN_PROGRESS',
      phoneNumber: prospectNumber,
      calledAt: createdAt,
      signalWireCallId: callSid,
      personId,
      companyId: person.companyId ?? null,
    });
    loggedRecordId = record?.id;
  } catch {
    // Not fatal: the call is already ringing. Saving an outcome creates the record.
  }

  await saveCall({
    callSid,
    workspaceMemberId,
    personId,
    prospectNumber,
    callerId: rep.callerId,
    stage: 'starting',
    repName,
    loggedRecordId,
    createdAt,
  });
  await setRepLatestCall(workspaceMemberId, callSid);

  return { ok: true as const, callSid, prospectNumber };
};

export default defineLogicFunction({
  universalIdentifier: START_CALL_FUNCTION_ID,
  name: 'dialer-start-call',
  description: "Rings the rep's phone, then connects them to the selected person.",
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_START_CALL,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
