import type { SignalWireSettings } from 'src/shared/settings';

// SignalWire's Twilio-compatible REST API ("LaML").
const apiBase = (settings: SignalWireSettings) =>
  `https://${settings.spaceUrl}/api/laml/2010-04-01/Accounts/${settings.projectId}`;

const authHeader = (settings: SignalWireSettings) =>
  `Basic ${Buffer.from(`${settings.projectId}:${settings.apiToken}`).toString('base64')}`;

const post = async (
  settings: SignalWireSettings,
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
  settings: SignalWireSettings,
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

export const endCall = async (settings: SignalWireSettings, callSid: string) => {
  const form = new URLSearchParams();
  form.set('Status', 'completed');
  await post(settings, `/Calls/${callSid}.json`, form);
};
