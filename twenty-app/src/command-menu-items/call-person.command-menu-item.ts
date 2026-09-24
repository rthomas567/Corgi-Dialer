import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  CALL_PERSON_COMMAND_MENU_ITEM_ID,
  DIALER_PANEL_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// The "Call" button in the top-right corner of a person's page.
export default defineCommandMenuItem({
  universalIdentifier: CALL_PERSON_COMMAND_MENU_ITEM_ID,
  label: 'Call this person',
  shortLabel: 'Call',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  frontComponentUniversalIdentifier: DIALER_PANEL_FRONT_COMPONENT_ID,
});
