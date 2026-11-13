import { defineFrontComponent } from 'twenty-sdk/define';

import { PowerDialer } from 'src/components/power-dialer';
import { POWER_DIALER_PEOPLE_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// Power / parallel dialer started from selected people.
export default defineFrontComponent({
  universalIdentifier: POWER_DIALER_PEOPLE_FRONT_COMPONENT_ID,
  name: 'power-dialer-people',
  description: 'Power / parallel dialer started from selected people.',
  component: () => <PowerDialer source="person" />,
});
