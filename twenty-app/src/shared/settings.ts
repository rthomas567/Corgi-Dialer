import { isDialableNumber } from 'src/shared/phone';

export type RepPhoneSettings = { callerId: string; ringTo: string };

export type TwilioSettings = {
  accountSid: string;
  authToken: string;
};

export const readTwilioSettings = (): TwilioSettings | null => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();

  if (!accountSid || !authToken) {
    return null;
  }
  return { accountSid, authToken };
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
