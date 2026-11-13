import { defineFrontComponent } from 'twenty-sdk/define';

import { PowerDialer } from 'src/components/power-dialer';
import { POWER_DIALER_RESUME_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// Reopens the rep's running dialing session.
export default defineFrontComponent({
  universalIdentifier: POWER_DIALER_RESUME_FRONT_COMPONENT_ID,
  name: 'power-dialer-resume',
  description: "Reopens the rep's running dialing session.",
  component: () => <PowerDialer source={null} />,
});
