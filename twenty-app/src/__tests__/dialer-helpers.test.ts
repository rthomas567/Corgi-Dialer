import { describe, expect, it, beforeEach } from 'vitest';

import { escapeXml } from 'src/shared/twiml';
import { isDialableNumber, toDialableNumber } from 'src/shared/phone';
import { readFormBody } from 'src/shared/route-body';
import { readRepSettings, readTwilioSettings } from 'src/shared/settings';

describe('toDialableNumber', () => {
  it('adds the calling code to a local number', () => {
    expect(
      toDialableNumber({ primaryPhoneNumber: '(469) 601-3979', primaryPhoneCallingCode: '+1' }),
    ).toBe('+14696013979');
  });
  it('defaults to +1 when no calling code is stored', () => {
    expect(toDialableNumber({ primaryPhoneNumber: '4696013979' })).toBe('+14696013979');
  });
  it('keeps numbers that already include a country code', () => {
    expect(toDialableNumber({ primaryPhoneNumber: '+44 20 7946 0958' })).toBe('+442079460958');
  });
  it('returns null for missing or too-short numbers', () => {
    expect(toDialableNumber({ primaryPhoneNumber: '' })).toBeNull();
    expect(toDialableNumber(null)).toBeNull();
    expect(toDialableNumber({ primaryPhoneNumber: '123' })).toBeNull();
  });
  it('checks dialable format', () => {
    expect(isDialableNumber('+15551234567')).toBe(true);
    expect(isDialableNumber('555-123-4567')).toBe(false);
  });
});

describe('readRepSettings', () => {
  beforeEach(() => {
    process.env.DIALER_REPS = JSON.stringify({
      'Ricky@BeagleForPM.com': { callerId: '+15551230000', ringTo: '+15559870000' },
      'bad@beagleforpm.com': { callerId: '555', ringTo: '+15559870000' },
    });
  });
  it('finds a rep regardless of email capitalization', () => {
    expect(readRepSettings('ricky@beagleforpm.com')).toEqual({
      callerId: '+15551230000',
      ringTo: '+15559870000',
    });
  });
  it('explains a missing rep', () => {
    expect(readRepSettings('nobody@beagleforpm.com')).toHaveProperty('error');
  });
  it('rejects a badly formatted caller ID', () => {
    expect(readRepSettings('bad@beagleforpm.com')).toHaveProperty('error');
  });
  it('handles broken settings text', () => {
    process.env.DIALER_REPS = '{not json';
    expect(readRepSettings('ricky@beagleforpm.com')).toHaveProperty('error');
  });
});

describe('readTwilioSettings', () => {
  it('trims pasted values', () => {
    process.env.TWILIO_ACCOUNT_SID = ' ACproject ';
    process.env.TWILIO_AUTH_TOKEN = 'token\n';
    expect(readTwilioSettings()).toEqual({ accountSid: 'ACproject', authToken: 'token' });
  });
  it('returns null when anything is missing', () => {
    process.env.TWILIO_AUTH_TOKEN = '';
    expect(readTwilioSettings()).toBeNull();
  });
});

describe('readFormBody', () => {
  const base = {
    headers: {},
    queryStringParameters: {},
    pathParameters: {},
    requestContext: { http: { method: 'POST', path: '/x' } },
    userWorkspaceId: null,
  };
  it('reads an already-parsed body', () => {
    expect(
      readFormBody({ ...base, body: { CallSid: 'CA1', CallStatus: 'ringing' }, isBase64Encoded: false }),
    ).toEqual({ CallSid: 'CA1', CallStatus: 'ringing' });
  });
  it('reads a raw form body', () => {
    expect(
      readFormBody({ ...base, body: null, rawBody: 'CallSid=CA2&CallStatus=completed', isBase64Encoded: false }),
    ).toEqual({ CallSid: 'CA2', CallStatus: 'completed' });
  });
  it('reads a base64 form body', () => {
    const raw = Buffer.from('CallSid=CA3&ParentCallSid=CA1').toString('base64');
    expect(readFormBody({ ...base, body: null, rawBody: raw, isBase64Encoded: true })).toEqual({
      CallSid: 'CA3',
      ParentCallSid: 'CA1',
    });
  });
});

describe('escapeXml', () => {
  it('escapes characters that would break call instructions', () => {
    expect(escapeXml('a&b<c>"d\'')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
  });
});
