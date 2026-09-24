import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  RECORDED_CALLS_NAV_ITEM_ID,
  RECORDED_CALLS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// "Recorded Calls" in Twenty's left sidebar.
export default defineNavigationMenuItem({
  universalIdentifier: RECORDED_CALLS_NAV_ITEM_ID,
  name: 'Recorded Calls',
  icon: 'IconPlayerPlay',
  position: 10,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: RECORDED_CALLS_VIEW_ID,
});
