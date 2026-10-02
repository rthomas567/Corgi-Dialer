import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { OPPORTUNITY_ATLAS_SUBMISSION_FIELD_ID } from 'src/constants/universal-identifiers';

// The Atlas submission (case) number an Opportunity came from.
export default defineField({
  universalIdentifier: OPPORTUNITY_ATLAS_SUBMISSION_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  type: FieldType.TEXT,
  name: 'atlasSubmissionNumber',
  label: 'Atlas Submission Number',
  description: 'The Atlas submission (case) this opportunity came from. Filled in by the Atlas sync.',
  icon: 'IconHash',
});
