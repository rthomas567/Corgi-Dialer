import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import {
  RECORDING_READY_FUNCTION_ID,
  ROUTE_RECORDING_READY,
} from 'src/constants/universal-identifiers';
import { getCall, updateCall } from 'src/shared/call-store';
import { twimlResponse } from 'src/shared/twiml';
import { readFormBody } from 'src/shared/route-body';
import { SIGNATURE_HEADERS } from 'src/shared/twilio-signature';
import { updateRecord } from 'src/shared/twenty-api';
import { isFromTwilio } from 'src/shared/verify-twilio';

// SignalWire calls this once a call's recording is ready. We attach a
// "Play recording" link to the call's Dialer Call record.
// SignalWire's recording files play without a login unless "Enforce HTTP Auth
// on media URLs" is turned on in SignalWire's Voice settings; their addresses
// are long and random, so they can't be guessed.
export const toPlayableUrl = (recordingUrl: string) =>
  /\.(mp3|wav)$/i.test(recordingUrl) ? recordingUrl : `${recordingUrl}.mp3`;

const handler = async (event: RoutePayload) => {
  const form = readFormBody(event);
  if (!isFromTwilio(event, ROUTE_RECORDING_READY, form)) {
    return new Response('Not from SignalWire', { status: 403 });
  }

  const status = (form.RecordingStatus || 'completed').toLowerCase();
  if (status !== 'completed' || !form.RecordingUrl) {
    return twimlResponse('');
  }

  // The recording can be reported against the rep's call or the person's leg.
  const call =
    (form.CallSid ? await getCall(form.CallSid) : null) ??
    (form.ParentCallSid ? await getCall(form.ParentCallSid) : null);
  if (!call) {
    return twimlResponse('');
  }

  const playableUrl = toPlayableUrl(form.RecordingUrl);
  const recordingSeconds = Number(form.RecordingDuration || 0);
  await updateCall(call.callSid, { recordingUrl: playableUrl, recordingSeconds });

  if (call.loggedRecordId) {
    await updateRecord(
      'dialerCalls',
      call.loggedRecordId,
      {
        recording: {
          primaryLinkUrl: playableUrl,
          primaryLinkLabel: 'Play recording',
          secondaryLinks: null,
        },
        recordingSeconds,
      },
      'application',
    );
  }

  return twimlResponse('');
};

export default defineLogicFunction({
  universalIdentifier: RECORDING_READY_FUNCTION_ID,
  name: 'dialer-recording-ready',
  description: 'Attaches the call recording to its Dialer Call record.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_RECORDING_READY,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: SIGNATURE_HEADERS,
  },
});
