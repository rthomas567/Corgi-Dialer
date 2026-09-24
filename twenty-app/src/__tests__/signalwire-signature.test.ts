import { afterEach, describe, expect, it } from 'vitest';

import { CALL_OUTCOMES, isCallOutcome } from 'src/shared/outcomes';
import {
  isGenuineSignalWireRequest,
  signFormRequest,
} from 'src/shared/signalwire-signature';

// Example checked against SignalWire's own validateRequest() and Twilio's.
const REFERENCE = {
  key: '12345',
  url: 'https://mycompany.com/myapp.php?foo=1&bar=2',
  params: {
    CallSid: 'CA1234567890ABCDE',
    Caller: '+12349013030',
    Digits: '1234',
    From: '+12349013030',
    To: '+18005551212',
  },
  signature: '0/KCTR6DLpKmkAf8muzZqo1nDgQ=',
};

describe('signFormRequest', () => {
  it('matches what the official SignalWire library expects', () => {
    expect(signFormRequest(REFERENCE.key, REFERENCE.url, REFERENCE.params)).toBe(
      REFERENCE.signature,
    );
  });
});

describe('isGenuineSignalWireRequest', () => {
  const url = 'https://corgi-smb.withtwenty.com/dialer/call-events';
  const params = { CallSid: 'CA1', CallStatus: 'completed' };
  const key = 'test-signing-key';
  const good = signFormRequest(key, url, params);

  it('accepts a correctly signed update', () => {
    expect(
      isGenuineSignalWireRequest({
        signingKey: key,
        url,
        headers: { 'X-SignalWire-Signature': good },
        formParams: params,
      }),
    ).toBe(true);
  });

  it('accepts the older header name too', () => {
    expect(
      isGenuineSignalWireRequest({
        signingKey: key,
        url,
        headers: { 'x-twilio-signature': good },
        formParams: params,
      }),
    ).toBe(true);
  });

  it('accepts a signature made with the :443 port in the address', () => {
    const withPort = signFormRequest(
      key,
      'https://corgi-smb.withtwenty.com:443/dialer/call-events',
      params,
    );
    expect(
      isGenuineSignalWireRequest({
        signingKey: key,
        url,
        headers: { 'x-signalwire-signature': withPort },
        formParams: params,
      }),
    ).toBe(true);
  });

  it('rejects a tampered update', () => {
    expect(
      isGenuineSignalWireRequest({
        signingKey: key,
        url,
        headers: { 'x-signalwire-signature': good },
        formParams: { ...params, CallStatus: 'in-progress' },
      }),
    ).toBe(false);
  });

  it('rejects an update with no signature', () => {
    expect(
      isGenuineSignalWireRequest({ signingKey: key, url, headers: {}, formParams: params }),
    ).toBe(false);
  });
});

describe('isFromSignalWire', () => {
  afterEach(() => {
    delete process.env.SIGNALWIRE_SIGNING_KEY;
  });

  it('lets everything through while no Signing Key is set', async () => {
    const { isFromSignalWire } = await import('src/shared/verify-signalwire');
    delete process.env.SIGNALWIRE_SIGNING_KEY;
    expect(
      isFromSignalWire(
        {
          headers: {},
          queryStringParameters: {},
          pathParameters: {},
          body: null,
          isBase64Encoded: false,
          requestContext: { http: { method: 'POST', path: '/x' } },
          userWorkspaceId: null,
        },
        '/dialer/call-events',
        {},
      ),
    ).toBe(true);
  });
});

describe('call outcomes', () => {
  it('has exactly the ten agreed outcomes', () => {
    expect(CALL_OUTCOMES.map((o) => o.label)).toEqual([
      'Connected', 'Voicemail', 'DNC', 'Busy', 'No Answer',
      'Receptionist', 'High Interest', 'Low Interest', 'Hard No', 'Wrong Number',
    ]);
  });
  it('rejects unknown outcomes', () => {
    expect(isCallOutcome('MEETING_BOOKED')).toBe(false);
    expect(isCallOutcome('HIGH_INTEREST')).toBe(true);
  });
});
