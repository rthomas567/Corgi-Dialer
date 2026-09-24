import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  BRIDGE_FUNCTION_ID,
  ROUTE_BRIDGE,
  ROUTE_CALL_EVENTS,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import { escapeXml, lamlResponse } from 'src/shared/laml';
import { readFormBody } from 'src/shared/route-body';
import { SIGNATURE_HEADERS } from 'src/shared/signalwire-signature';
import { isFromSignalWire } from 'src/shared/verify-signalwire';
import { functionsBaseUrl } from 'src/shared/twenty-api';

// SignalWire calls this the moment the rep picks up their phone.
// We answer with instructions: "now dial the prospect".
// The number to dial comes from our own stored call, never from the
// request itself, so this address can't be used to dial other numbers.
const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromSignalWire(event, ROUTE_BRIDGE, form)) {
    return new Response('Not from SignalWire', { status: 403 });
  }
  const callSid = form.CallSid;
  const call = callSid ? await getCall(callSid) : null;

  if (!call || call.stage === 'ended') {
    return lamlResponse('<Say>This call could not be connected.</Say><Hangup/>');
  }

  await updateCall(call.callSid, { stage: 'prospect-ringing' });

  const eventsUrl = escapeXml(`${functionsBaseUrl()}${ROUTE_CALL_EVENTS}`);

  return lamlResponse(
    `<Say>Connecting.</Say>` +
      `<Dial callerId="${escapeXml(call.callerId)}" timeout="30" answerOnBridge="true">` +
      `<Number statusCallback="${eventsUrl}" statusCallbackMethod="POST" statusCallbackEvent="ringing answered completed">` +
      escapeXml(call.prospectNumber) +
      `</Number></Dial>`,
  );
};

export default defineLogicFunction({
  universalIdentifier: BRIDGE_FUNCTION_ID,
  name: 'dialer-bridge',
  description: 'Tells SignalWire to dial the prospect once the rep answers.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_BRIDGE,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
