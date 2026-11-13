import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  QUEUE_COMPANIES_COMMAND_ID,
  ADD_TO_QUEUE_COMPANIES_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// "Add to Call Queue" on selected companies.
export default defineCommandMenuItem({
  universalIdentifier: QUEUE_COMPANIES_COMMAND_ID,
  label: 'Add to Call Queue',
  shortLabel: 'Queue',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  frontComponentUniversalIdentifier: ADD_TO_QUEUE_COMPANIES_FRONT_COMPONENT_ID,
});
