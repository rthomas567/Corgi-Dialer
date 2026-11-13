import { isDialableNumber } from 'src/shared/phone';

export type RepPhoneSettings = { callerId: string; ringTo: string };

// SignalWire test version: SignalWire's SignalWire-compatible API ("LaML").
// accountSid = SignalWire Project ID, authToken = SignalWire API Token.
export type TwilioSettings = {
  accountSid: string;
  authToken: string;
  apiBase: string;
};

export const readTwilioSettings = (): TwilioSettings | null => {
  const spaceUrl = (process.env.SIGNALWIRE_SPACE_URL ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const accountSid = (process.env.SIGNALWIRE_PROJECT_ID ?? '').trim();
  const authToken = (process.env.SIGNALWIRE_API_TOKEN ?? '').trim();

  if (!spaceUrl || !accountSid || !authToken) {
    return null;
  }
  return {
    accountSid,
    authToken,
    apiBase: `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${accountSid}`,
  };
};

export const readRepSettings = (
  email: string,
): RepPhoneSettings | { error: string } => {
  let parsed: Record<string, Partial<RepPhoneSettings>>;
  try {
    parsed = JSON.parse(process.env.DIALER_REPS || '{}');
  } catch {
    return { error: 'The "Rep phone settings" in the app settings are not valid. Ask an admin to fix them.' };
  }

  const entry = Object.entries(parsed).find(
    ([key]) => key.trim().toLowerCase() === email.trim().toLowerCase(),
  )?.[1];

  if (!entry) {
    return { error: `No phone settings found for ${email}. Ask an admin to add you in Settings > Apps > Corgi Dialer.` };
  }
  if (!isDialableNumber(entry.callerId)) {
    return { error: `Your caller ID number is missing or not in +15551234567 format. Ask an admin to fix it.` };
  }
  if (!isDialableNumber(entry.ringTo)) {
    return { error: `The phone to ring for you is missing or not in +15551234567 format. Ask an admin to fix it.` };
  }
  return { callerId: entry.callerId, ringTo: entry.ringTo };
};
