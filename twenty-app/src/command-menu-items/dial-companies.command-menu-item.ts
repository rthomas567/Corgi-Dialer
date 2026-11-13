import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  DIAL_COMPANIES_COMMAND_ID,
  POWER_DIALER_COMPANIES_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// "Start dialing" on selected companies (calls their main line).
export default defineCommandMenuItem({
  universalIdentifier: DIAL_COMPANIES_COMMAND_ID,
  label: 'Start dialing',
  shortLabel: 'Dial',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  frontComponentUniversalIdentifier: POWER_DIALER_COMPANIES_FRONT_COMPONENT_ID,
});
