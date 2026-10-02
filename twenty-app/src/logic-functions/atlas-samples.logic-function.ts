import { defineLogicFunction } from 'twenty-sdk/define';

import { getSamples } from 'src/atlas/store';
import {
  ATLAS_SAMPLES_FUNCTION_ID,
  ROUTE_ATLAS_SAMPLES,
} from 'src/constants/universal-identifiers';

// The last 10 Atlas messages received, for checking the field mapping against
// real data. Signed-in Twenty users only.
const handler = async () => ({ ok: true, samples: await getSamples() });

export default defineLogicFunction({
  universalIdentifier: ATLAS_SAMPLES_FUNCTION_ID,
  name: 'atlas-samples',
  description: 'Shows the most recent Atlas messages the sync received.',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_ATLAS_SAMPLES,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
