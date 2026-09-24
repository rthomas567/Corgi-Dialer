import { defineField, FieldType, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  COMPANY_DIALER_CALLS_FIELD_ID,
  DIALER_CALL_COMPANY_FIELD_ID,
  DIALER_CALL_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// The "Dialer Calls" list on each company's page.
export default defineField({
  universalIdentifier: COMPANY_DIALER_CALLS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'dialerCalls',
  label: 'Dialer Calls',
  icon: 'IconPhone',
  relationTargetObjectMetadataUniversalIdentifier: DIALER_CALL_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: DIALER_CALL_COMPANY_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
