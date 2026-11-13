import { defineField, FieldType, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  CALL_QUEUE_PERSON_FIELD_ID,
  CALL_QUEUE_OBJECT_ID,
  PERSON_CALL_QUEUE_FIELD_ID,
} from 'src/constants/universal-identifiers';

// The Call Queue entries for each person.
export default defineField({
  universalIdentifier: PERSON_CALL_QUEUE_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'callQueueItems',
  label: 'Call Queue',
  icon: 'IconListNumbers',
  relationTargetObjectMetadataUniversalIdentifier: CALL_QUEUE_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: CALL_QUEUE_PERSON_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
