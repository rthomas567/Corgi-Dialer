import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import {
  CALL_QUEUE_COMPANY_FIELD_ID,
  CALL_QUEUE_LAST_CALLED_FIELD_ID,
  CALL_QUEUE_LAST_RESULT_FIELD_ID,
  CALL_QUEUE_NAME_FIELD_ID,
  CALL_QUEUE_OBJECT_ID,
  CALL_QUEUE_PERSON_FIELD_ID,
  CALL_QUEUE_SORT_ID,
  CALL_QUEUE_STATUS_FIELD_ID,
  CALL_QUEUE_VIEW_FIELD_IDS,
  CALL_QUEUE_VIEW_ID,
} from 'src/constants/universal-identifiers';

const columns = [
  CALL_QUEUE_NAME_FIELD_ID,
  CALL_QUEUE_STATUS_FIELD_ID,
  CALL_QUEUE_PERSON_FIELD_ID,
  CALL_QUEUE_COMPANY_FIELD_ID,
  CALL_QUEUE_LAST_RESULT_FIELD_ID,
  CALL_QUEUE_LAST_CALLED_FIELD_ID,
];

// "Call Queue" in the sidebar: everyone waiting to be called.
export default defineView({
  universalIdentifier: CALL_QUEUE_VIEW_ID,
  name: 'Call Queue',
  objectUniversalIdentifier: CALL_QUEUE_OBJECT_ID,
  type: ViewType.TABLE,
  icon: 'IconListNumbers',
  position: 0,
  fields: columns.map((fieldId, position) => ({
    universalIdentifier: CALL_QUEUE_VIEW_FIELD_IDS[position],
    fieldMetadataUniversalIdentifier: fieldId,
    position,
    isVisible: true,
  })),
  sorts: [
    {
      universalIdentifier: CALL_QUEUE_SORT_ID,
      fieldMetadataUniversalIdentifier: CALL_QUEUE_STATUS_FIELD_ID,
      direction: ViewSortDirection.ASC,
    },
  ],
});
