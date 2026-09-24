import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  VAR_DIALER_REPS_ID,
  VAR_SIGNALWIRE_API_TOKEN_ID,
  VAR_SIGNALWIRE_PROJECT_ID_ID,
  VAR_SIGNALWIRE_SIGNING_KEY_ID,
  VAR_SIGNALWIRE_SPACE_URL_ID,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    SIGNALWIRE_SPACE_URL: {
      universalIdentifier: VAR_SIGNALWIRE_SPACE_URL_ID,
      label: 'SignalWire Space URL',
      description: 'For example: corgi-atlas.signalwire.com',
      isSecret: false,
      value: '',
    },
    SIGNALWIRE_PROJECT_ID: {
      universalIdentifier: VAR_SIGNALWIRE_PROJECT_ID_ID,
      label: 'SignalWire Project ID',
      description: 'SignalWire dashboard > API > Project ID',
      isSecret: true,
    },
    SIGNALWIRE_API_TOKEN: {
      universalIdentifier: VAR_SIGNALWIRE_API_TOKEN_ID,
      label: 'SignalWire API Token',
      description: 'SignalWire dashboard > API > your API token',
      isSecret: true,
    },
    SIGNALWIRE_SIGNING_KEY: {
      universalIdentifier: VAR_SIGNALWIRE_SIGNING_KEY_ID,
      label: 'SignalWire Signing Key',
      description:
        'SignalWire dashboard > API Credentials > Signing Key. When filled in, the dialer ignores any call update that did not come from SignalWire.',
      isSecret: true,
    },
    DIALER_REPS: {
      universalIdentifier: VAR_DIALER_REPS_ID,
      label: 'Rep phone settings',
      description:
        'One entry per rep, keyed by their Twenty login email. callerId = their SignalWire number, ringTo = the phone to ring first. Example: {"ricky@beagleforpm.com":{"callerId":"+15551230000","ringTo":"+15559870000"}}',
      isSecret: false,
      value: '{}',
    },
  },
});
