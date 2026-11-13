import { defineFrontComponent } from 'twenty-sdk/define';

import { PowerDialer } from 'src/components/power-dialer';
import { POWER_DIALER_QUEUE_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';

// Power / parallel dialer started from selected Call Queue entries.
export default defineFrontComponent({
  universalIdentifier: POWER_DIALER_QUEUE_FRONT_COMPONENT_ID,
  name: 'power-dialer-queue',
  description: 'Power / parallel dialer started from selected Call Queue entries.',
  component: () => <PowerDialer source="callQueueItem" />,
});
