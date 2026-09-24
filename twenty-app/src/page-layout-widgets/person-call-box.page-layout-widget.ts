import {
  definePageLayoutWidget,
  PageLayoutTabLayoutMode,
  PageLayoutWidgetVerticalListHeightBehavior,
  STANDARD_OBJECT,
  STANDARD_PAGE_LAYOUT,
} from 'twenty-sdk/define';

import {
  PERSON_CALL_BOX_FRONT_COMPONENT_ID,
  PERSON_CALL_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// Puts the dialer at the top of the Home tab on every person's page.
export default definePageLayoutWidget({
  universalIdentifier: PERSON_CALL_WIDGET_ID,
  pageLayoutTabUniversalIdentifier: STANDARD_PAGE_LAYOUT.personRecordPage.tabs.home.universalIdentifier,
  title: 'Call',
  type: 'FRONT_COMPONENT',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  position: {
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    index: 0,
    heightBehavior: PageLayoutWidgetVerticalListHeightBehavior.FIT_CONTENT,
  },
  configuration: {
    configurationType: 'FRONT_COMPONENT',
    frontComponentUniversalIdentifier: PERSON_CALL_BOX_FRONT_COMPONENT_ID,
  },
});
