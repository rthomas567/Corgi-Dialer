import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  OPEN_DIALER_COMMAND_ID,
  POWER_DIALER_RESUME_FRONT_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

// "Open dialer" from the command menu (Ctrl/Cmd+K), to get back to a running session.
export default defineCommandMenuItem({
  universalIdentifier: OPEN_DIALER_COMMAND_ID,
  label: 'Open dialer',
  shortLabel: 'Dialer',
  isPinned: false,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: POWER_DIALER_RESUME_FRONT_COMPONENT_ID,
});
