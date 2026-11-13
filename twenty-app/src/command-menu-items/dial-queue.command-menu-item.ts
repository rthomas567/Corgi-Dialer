import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  CALL_QUEUE_OBJECT_ID,
  DIAL_QUEUE_COMMAND_ID,
  POWER_DIALER_QUEUE_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// "Start dialing" on selected Call Queue entries.
export default defineCommandMenuItem({
  universalIdentifier: DIAL_QUEUE_COMMAND_ID,
  label: 'Start dialing',
  shortLabel: 'Dial',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CALL_QUEUE_OBJECT_ID,
  frontComponentUniversalIdentifier: POWER_DIALER_QUEUE_FRONT_COMPONENT_ID,
});
