import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  VAR_DIALER_REPS_ID,
  VAR_RECORDING_ANNOUNCEMENT_ID,
  VAR_TWILIO_ACCOUNT_SID_ID,
  VAR_TWILIO_AUTH_TOKEN_ID,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    TWILIO_ACCOUNT_SID: {
      universalIdentifier: VAR_TWILIO_ACCOUNT_SID_ID,
      label: 'Twilio Account SID',
      description: 'Twilio Console home page > Account Info > Account SID (starts with AC)',
      isSecret: true,
    },
    TWILIO_AUTH_TOKEN: {
      universalIdentifier: VAR_TWILIO_AUTH_TOKEN_ID,
      label: 'Twilio Auth Token',
      description:
        'Twilio Console home page > Account Info > Auth Token. Also used to check that every call update really came from Twilio.',
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
    DIALER_REPS: {
      universalIdentifier: VAR_DIALER_REPS_ID,
      label: 'Rep phone settings',
      description:
        'One entry per rep, keyed by their Twenty login email. callerId = their Twilio number (or a number verified in Twilio), ringTo = the phone to ring first. Example: {"ricky@beagleforpm.com":{"callerId":"+15551230000","ringTo":"+15559870000"}}',
      isSecret: false,
      value: '{}',
    },
  },
});
