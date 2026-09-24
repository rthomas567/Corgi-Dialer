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
import { saveCall } from 'src/shared/call-store';
import { getDoNotCallStatus } from 'src/shared/dnc';
import { toDialableNumber, type TwentyPhones } from 'src/shared/phone';
import { readJsonBody } from 'src/shared/route-body';
import { readRepSettings, readSignalWireSettings } from 'src/shared/settings';
import { ringRepPhone } from 'src/shared/signalwire';
import { functionsBaseUrl, getRecord } from 'src/shared/twenty-api';

type Person = {
  id: string;
  phones?: TwentyPhones;
  companyId?: string | null;
};
type WorkspaceMember = { id: string; userEmail?: string | null };

const fail = (message: string) => ({ ok: false as const, message });

const handler = async (
  event: RoutePayload,
  context: LogicFunctionExecutionContext,
) => {
  const workspaceMemberId = context.workspaceMemberId;
  if (!workspaceMemberId) {
    return fail('You need to be signed in to Twenty to place a call.');
  }

  const { personId } = readJsonBody<{ personId: string }>(event);
  if (!personId) {
    return fail('No person was selected.');
  }

  const signalWire = readSignalWireSettings();
  if (!signalWire) {
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

  // Never dial anyone marked Do Not Call, even if the panel was already open.
  const dncStatus = await getDoNotCallStatus(personId);
  if (dncStatus.doNotCall) {
    return fail(dncStatus.reason ?? 'This person is marked Do Not Call.');
  }

  const prospectNumber = toDialableNumber(person.phones);
  if (!prospectNumber) {
    return fail('This person has no usable phone number.');
  }

  const baseUrl = functionsBaseUrl();

  let callSid: string;
  try {
    callSid = await ringRepPhone(signalWire, {
      repPhone: rep.ringTo,
      callerId: rep.callerId,
      bridgeUrl: `${baseUrl}${ROUTE_BRIDGE}`,
      eventsUrl: `${baseUrl}${ROUTE_CALL_EVENTS}`,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'SignalWire could not start the call.');
  }

  await saveCall({
    callSid,
    workspaceMemberId,
    personId,
    prospectNumber,
    callerId: rep.callerId,
    stage: 'starting',
    createdAt: new Date().toISOString(),
  });

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
