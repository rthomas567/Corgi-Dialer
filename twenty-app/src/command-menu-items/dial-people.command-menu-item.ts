import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  DIAL_PEOPLE_COMMAND_ID,
  POWER_DIALER_PEOPLE_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// "Start dialing" on selected people.
export default defineCommandMenuItem({
  universalIdentifier: DIAL_PEOPLE_COMMAND_ID,
  label: 'Start dialing',
  shortLabel: 'Dial',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  frontComponentUniversalIdentifier: POWER_DIALER_PEOPLE_FRONT_COMPONENT_ID,
});
