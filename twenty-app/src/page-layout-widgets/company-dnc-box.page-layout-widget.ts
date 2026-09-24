import {
  definePageLayoutWidget,
  PageLayoutTabLayoutMode,
  PageLayoutWidgetVerticalListHeightBehavior,
  STANDARD_OBJECT,
  STANDARD_PAGE_LAYOUT,
} from 'twenty-sdk/define';

import {
  COMPANY_DNC_BOX_FRONT_COMPONENT_ID,
  COMPANY_DNC_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// Puts the Do Not Call status at the top of the Home tab on every company page.
export default definePageLayoutWidget({
  universalIdentifier: COMPANY_DNC_WIDGET_ID,
  pageLayoutTabUniversalIdentifier: STANDARD_PAGE_LAYOUT.companyRecordPage.tabs.home.universalIdentifier,
  title: 'Do Not Call',
  type: 'FRONT_COMPONENT',
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  position: {
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    index: 0,
    heightBehavior: PageLayoutWidgetVerticalListHeightBehavior.FIT_CONTENT,
  },
  configuration: {
    configurationType: 'FRONT_COMPONENT',
    frontComponentUniversalIdentifier: COMPANY_DNC_BOX_FRONT_COMPONENT_ID,
  },
});
