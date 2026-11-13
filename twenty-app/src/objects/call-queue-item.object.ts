import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  CALL_QUEUE_COMPANY_FIELD_ID,
  CALL_QUEUE_LAST_CALLED_FIELD_ID,
  CALL_QUEUE_LAST_RESULT_FIELD_ID,
  CALL_QUEUE_NAME_FIELD_ID,
  CALL_QUEUE_OBJECT_ID,
  CALL_QUEUE_PERSON_FIELD_ID,
  CALL_QUEUE_STATUS_FIELD_ID,
  COMPANY_CALL_QUEUE_FIELD_ID,
  PERSON_CALL_QUEUE_FIELD_ID,
} from 'src/constants/universal-identifiers';

export const CALL_QUEUE_STATUSES = [
  { value: 'WAITING', label: 'Waiting', color: 'blue' },
  { value: 'CALLED', label: 'Called', color: 'green' },
  { value: 'SKIPPED_DNC', label: 'Skipped - DNC', color: 'red' },
  { value: 'NO_NUMBER', label: 'No phone number', color: 'gray' },
] as const;

// "Call Queue": a list of people and companies waiting to be called.
// Reps or managers add to it with "Add to Call Queue", then select entries
// and click "Start dialing".
export default defineObject({
  universalIdentifier: CALL_QUEUE_OBJECT_ID,
  nameSingular: 'callQueueItem',
  namePlural: 'callQueueItems',
  labelSingular: 'Call Queue Entry',
  labelPlural: 'Call Queue',
  description: 'People and companies waiting to be called by the dialer.',
  icon: 'IconListNumbers',
  labelIdentifierFieldMetadataUniversalIdentifier: CALL_QUEUE_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: CALL_QUEUE_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconUser',
    },
    {
      universalIdentifier: CALL_QUEUE_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgress',
      defaultValue: "'WAITING'",
      options: CALL_QUEUE_STATUSES.map((status, position) => ({ ...status, position })),
    },
    {
      universalIdentifier: CALL_QUEUE_LAST_RESULT_FIELD_ID,
      type: FieldType.TEXT,
      name: 'lastResult',
      label: 'Last result',
      icon: 'IconPhoneCall',
    },
    {
      universalIdentifier: CALL_QUEUE_LAST_CALLED_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'lastCalledAt',
      label: 'Last called',
      icon: 'IconCalendarEvent',
    },
    {
      universalIdentifier: CALL_QUEUE_PERSON_FIELD_ID,
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: PERSON_CALL_QUEUE_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'personId',
      },
    },
    {
      universalIdentifier: CALL_QUEUE_COMPANY_FIELD_ID,
      type: FieldType.RELATION,
      name: 'company',
      label: 'Company',
      icon: 'IconBuildingSkyscraper',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: COMPANY_CALL_QUEUE_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'companyId',
      },
    },
  ],
});
