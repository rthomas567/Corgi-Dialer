import { defineFrontComponent } from 'twenty-sdk/define';

import { PowerDialer } from 'src/components/power-dialer';
import { POWER_DIALER_COMPANIES_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// Power / parallel dialer started from selected companies (main line).
export default defineFrontComponent({
  universalIdentifier: POWER_DIALER_COMPANIES_FRONT_COMPONENT_ID,
  name: 'power-dialer-companies',
  description: 'Power / parallel dialer started from selected companies (main line).',
  component: () => <PowerDialer source="company" />,
});
