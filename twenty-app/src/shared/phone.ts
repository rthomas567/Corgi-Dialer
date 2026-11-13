// Turns a Twenty "phones" field into a dialable number like +15551234567.
export type TwentyPhones = {
  primaryPhoneNumber?: string | null;
  primaryPhoneCallingCode?: string | null;
  primaryPhoneCountryCode?: string | null;
} | null | undefined;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const toDialableNumber = (phones: TwentyPhones): string | null => {
  const rawNumber = phones?.primaryPhoneNumber?.trim();
  if (!rawNumber) {
    return null;
  }

  // Already has a country code, e.g. "+1 555..."
  if (rawNumber.startsWith('+')) {
    const digits = digitsOnly(rawNumber);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const callingCode = digitsOnly(phones?.primaryPhoneCallingCode ?? '') || '1';
  const digits = digitsOnly(rawNumber);
  return digits.length >= 7 ? `+${callingCode}${digits}` : null;
};

export const isDialableNumber = (value: unknown): value is string =>
  typeof value === 'string' && /^\+\d{8,15}$/.test(value);

// The first usable number out of several phone fields, in order of preference.
export const firstDialableNumber = (...fields: TwentyPhones[]): string | null => {
  for (const field of fields) {
    const number = toDialableNumber(field);
    if (number) {
      return number;
    }
  }
  return null;
};
