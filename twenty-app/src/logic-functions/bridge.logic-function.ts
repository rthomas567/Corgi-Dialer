import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  BRIDGE_FUNCTION_ID,
  ROUTE_BRIDGE,
  ROUTE_CALL_EVENTS,
  ROUTE_RECORDING_READY,
  ROUTE_WHISPER,
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

  await updateCall(call.callSid, { stage: 'prospect-ringing', repAnswered: true });

  const base = functionsBaseUrl();
  const eventsUrl = escapeXml(`${base}${ROUTE_CALL_EVENTS}`);
  const recordingUrl = escapeXml(`${base}${ROUTE_RECORDING_READY}`);
  // When the person picks up, they hear the recording announcement before
  // being connected (the rep keeps hearing ringing meanwhile).
  const announcement = (process.env.RECORDING_ANNOUNCEMENT ?? '').trim();
  const whisperAttribute = announcement
    ? ` url="${escapeXml(`${base}${ROUTE_WHISPER}`)}" method="POST"`
    : '';

  return lamlResponse(
    `<Say>Connecting.</Say>` +
      `<Dial callerId="${escapeXml(call.callerId)}" timeout="30" answerOnBridge="true"` +
      ` record="record-from-answer" recordingStatusCallback="${recordingUrl}"` +
      ` recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed">` +
      `<Number statusCallback="${eventsUrl}" statusCallbackMethod="POST" statusCallbackEvent="ringing answered completed"${whisperAttribute}>` +
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
