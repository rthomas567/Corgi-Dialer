import {
  defineView,
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
} from 'twenty-sdk/define';

import {
  DIALER_CALL_CALLED_AT_FIELD_ID,
  DIALER_CALL_COMPANY_FIELD_ID,
  DIALER_CALL_NAME_FIELD_ID,
  DIALER_CALL_NOTES_FIELD_ID,
  DIALER_CALL_OBJECT_ID,
  DIALER_CALL_OUTCOME_FIELD_ID,
  DIALER_CALL_PERSON_FIELD_ID,
  DIALER_CALL_RECORDING_FIELD_ID,
  DIALER_CALL_RECORDING_SECONDS_FIELD_ID,
  DIALER_CALL_REP_FIELD_ID,
  RECORDED_CALLS_FILTER_ID,
  RECORDED_CALLS_SORT_ID,
  RECORDED_CALLS_VIEW_FIELD_IDS,
  RECORDED_CALLS_VIEW_ID,
} from 'src/constants/universal-identifiers';

// "Recorded Calls": every dialer call that has a recording, newest first.
// Reps can be filtered with the Rep column (or "Created by").
const columns = [
  DIALER_CALL_NAME_FIELD_ID,
  DIALER_CALL_REP_FIELD_ID,
  DIALER_CALL_RECORDING_FIELD_ID,
  DIALER_CALL_OUTCOME_FIELD_ID,
  DIALER_CALL_CALLED_AT_FIELD_ID,
  DIALER_CALL_RECORDING_SECONDS_FIELD_ID,
  DIALER_CALL_PERSON_FIELD_ID,
  DIALER_CALL_COMPANY_FIELD_ID,
  DIALER_CALL_NOTES_FIELD_ID,
];

export default defineView({
  universalIdentifier: RECORDED_CALLS_VIEW_ID,
  name: 'Recorded Calls',
  objectUniversalIdentifier: DIALER_CALL_OBJECT_ID,
  type: ViewType.TABLE,
  icon: 'IconPlayerPlay',
  position: 0,
  fields: columns.map((fieldId, position) => ({
    universalIdentifier: RECORDED_CALLS_VIEW_FIELD_IDS[position],
    fieldMetadataUniversalIdentifier: fieldId,
    position,
    isVisible: true,
  })),
  filters: [
    {
      universalIdentifier: RECORDED_CALLS_FILTER_ID,
      fieldMetadataUniversalIdentifier: DIALER_CALL_RECORDING_SECONDS_FIELD_ID,
      operand: ViewFilterOperand.IS_NOT_EMPTY,
      value: '',
    },
  ],
  sorts: [
    {
      universalIdentifier: RECORDED_CALLS_SORT_ID,
      fieldMetadataUniversalIdentifier: DIALER_CALL_CALLED_AT_FIELD_ID,
      direction: ViewSortDirection.DESC,
    },
  ],
});
