import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  CALL_QUEUE_NAV_ITEM_ID,
  CALL_QUEUE_VIEW_ID,
} from 'src/constants/universal-identifiers';

// "Call Queue" in Twenty's left sidebar.
export default defineNavigationMenuItem({
  universalIdentifier: CALL_QUEUE_NAV_ITEM_ID,
  name: 'Call Queue',
  icon: 'IconListNumbers',
  position: 9,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: CALL_QUEUE_VIEW_ID,
});
