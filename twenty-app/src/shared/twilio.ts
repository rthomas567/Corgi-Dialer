import type { TwilioSettings } from 'src/shared/settings';

// SignalWire's SignalWire-compatible REST API (LaML).
const apiBase = (settings: TwilioSettings) => settings.apiBase;

const authHeader = (settings: TwilioSettings) =>
  `Basic ${Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64')}`;

const post = async (
  settings: TwilioSettings,
  path: string,
  form: URLSearchParams,
) => {
  const response = await fetch(`${apiBase(settings)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(settings),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    const message =
      (json.message as string) ||
      (json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ||
      response.statusText;
    throw new Error(`SignalWire said: ${message} (status ${response.status})`);
  }
  return json;
};

// Step 1 of a call: ring the rep's own phone. When they answer, SignalWire
// asks `bridgeUrl` what to do next (dial the prospect).
export const ringRepPhone = async (
  settings: TwilioSettings,
  input: {
    repPhone: string;
    callerId: string;
    bridgeUrl: string;
    eventsUrl: string;
  },
): Promise<string> => {
  const form = new URLSearchParams();
  form.set('To', input.repPhone);
  form.set('From', input.callerId);
  form.set('Url', input.bridgeUrl);
  form.set('Method', 'POST');
  form.set('StatusCallback', input.eventsUrl);
  form.set('StatusCallbackMethod', 'POST');
  for (const event of ['initiated', 'ringing', 'answered', 'completed']) {
    form.append('StatusCallbackEvent', event);
  }
  // Give the rep ~25 seconds to pick up before giving up.
  form.set('Timeout', '25');

  const json = await post(settings, '/Calls.json', form);
  const sid = json.sid;
  if (typeof sid !== 'string') {
    throw new Error('SignalWire did not return a call ID.');
  }
  return sid;
};

export const endCall = async (settings: TwilioSettings, callSid: string) => {
  const form = new URLSearchParams();
  form.set('Status', 'completed');
  await post(settings, `/Calls/${callSid}.json`, form);
};

// Power/parallel dialing: call one prospect directly. SignalWire first listens to
// whoever picks up to tell a person from a voicemail, then asks `answeredUrl`
// what to do (with AnsweredBy = human / machine_start / fax / unknown).
export const dialProspect = async (
  settings: TwilioSettings,
  input: {
    to: string;
    callerId: string;
    answeredUrl: string;
    eventsUrl: string;
  },
): Promise<string> => {
  const form = new URLSearchParams();
  form.set('To', input.to);
  form.set('From', input.callerId);
  form.set('Url', input.answeredUrl);
  form.set('Method', 'POST');
  form.set('StatusCallback', input.eventsUrl);
  form.set('StatusCallbackMethod', 'POST');
  for (const event of ['initiated', 'ringing', 'answered', 'completed']) {
    form.append('StatusCallbackEvent', event);
  }
  form.set('Timeout', '25');
  form.set('MachineDetection', 'Enable');
  // Give up listening after 8 seconds and treat it as a person.
  form.set('MachineDetectionTimeout', '8');

  const json = await post(settings, '/Calls.json', form);
  const sid = json.sid;
  if (typeof sid !== 'string') {
    throw new Error('SignalWire did not return a call ID.');
  }
  return sid;
};

// Records one call leg (both sides of the conversation on that leg).
export const startRecording = async (
  settings: TwilioSettings,
  callSid: string,
  recordingReadyUrl: string,
) => {
  const form = new URLSearchParams();
  form.set('RecordingStatusCallback', recordingReadyUrl);
  form.set('RecordingStatusCallbackMethod', 'POST');
  form.set('RecordingStatusCallbackEvent', 'completed');
  form.set('RecordingChannels', 'mono');
  await post(settings, `/Calls/${callSid}/Recordings.json`, form);
};
