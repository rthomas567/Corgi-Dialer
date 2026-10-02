import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  VAR_ATLAS_API_KEY_ID,
  VAR_ATLAS_ENVIRONMENT_ID,
  VAR_ATLAS_WEBHOOK_SECRET_ID,
  VAR_DIALER_REPS_ID,
  VAR_RECORDING_ANNOUNCEMENT_ID,
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
    RECORDING_ANNOUNCEMENT: {
      universalIdentifier: VAR_RECORDING_ANNOUNCEMENT_ID,
      label: 'Recording announcement',
      description:
        'Said to the person being called when they pick up, before they are connected. Several states (including Illinois and California) require everyone on a call to agree to recording. Clear this only if you are sure you do not need it.',
      isSecret: false,
      value: 'Hello. This call may be recorded for quality and training purposes.',
    },
    ATLAS_WEBHOOK_SECRET: {
      universalIdentifier: VAR_ATLAS_WEBHOOK_SECRET_ID,
      label: 'Atlas webhook signing secret',
      description:
        'The signing secret Atlas shows for the webhook subscription pointing at this app. Every Atlas message is checked against it; with it empty, all Atlas messages are refused.',
      isSecret: true,
    },
    ATLAS_API_KEY: {
      universalIdentifier: VAR_ATLAS_API_KEY_ID,
      label: 'Atlas API key',
      description:
        'Optional. A cg_live_ key used to look up a quote (insured name, premium) when a message does not carry it.',
      isSecret: true,
    },
    ATLAS_ENVIRONMENT: {
      universalIdentifier: VAR_ATLAS_ENVIRONMENT_ID,
      label: 'Atlas environment',
      description:
        'live (default): only real business creates Opportunities. test: only sandbox messages are processed, for trying the sync safely.',
      isSecret: false,
      value: 'live',
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
