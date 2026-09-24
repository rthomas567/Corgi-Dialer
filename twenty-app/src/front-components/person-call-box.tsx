import { defineFrontComponent } from 'twenty-sdk/define';

import { Dialer } from 'src/components/dialer';
import { PERSON_CALL_BOX_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// The dialer shown as a box at the top of each person's page, with a big
// orange Call button.
export default defineFrontComponent({
  universalIdentifier: PERSON_CALL_BOX_FRONT_COMPONENT_ID,
  name: 'person-call-box',
  description: 'Big orange Call button (and the call itself) on the person page.',
  component: Dialer,
});
