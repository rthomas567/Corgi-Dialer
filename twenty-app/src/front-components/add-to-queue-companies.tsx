import { defineFrontComponent } from 'twenty-sdk/define';

import { AddToQueue } from 'src/components/add-to-queue';
import { ADD_TO_QUEUE_COMPANIES_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// Adds selected companies to the Call Queue.
export default defineFrontComponent({
  universalIdentifier: ADD_TO_QUEUE_COMPANIES_FRONT_COMPONENT_ID,
  name: 'add-to-queue-companies',
  description: 'Adds selected companies to the Call Queue.',
  component: () => <AddToQueue source="company" />,
});
