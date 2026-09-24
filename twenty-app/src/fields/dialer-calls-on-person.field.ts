import { defineField, FieldType, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  DIALER_CALL_OBJECT_ID,
  DIALER_CALL_PERSON_FIELD_ID,
  PERSON_DIALER_CALLS_FIELD_ID,
} from 'src/constants/universal-identifiers';

// The "Dialer Calls" list on each person's page.
export default defineField({
  universalIdentifier: PERSON_DIALER_CALLS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'dialerCalls',
  label: 'Dialer Calls',
  icon: 'IconPhone',
  relationTargetObjectMetadataUniversalIdentifier: DIALER_CALL_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: DIALER_CALL_PERSON_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
