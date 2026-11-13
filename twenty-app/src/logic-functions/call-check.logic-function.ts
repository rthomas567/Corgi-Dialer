import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  CALL_CHECK_FUNCTION_ID,
  ROUTE_CALL_CHECK,
} from 'src/constants/universal-identifiers';
import { getDoNotCallStatus } from 'src/shared/dnc';
import { firstDialableNumber, type TwentyPhones } from 'src/shared/phone';
import { getRecord } from 'src/shared/twenty-api';

type Person = { id: string; phones?: TwentyPhones; mobilePhone?: TwentyPhones };

// The panel asks this when it opens: "is this person OK to call?"
const handler = async (event: RoutePayload) => {
  const personId = event.queryStringParameters?.personId;
  if (!personId) {
    return { ok: false as const, message: 'No person was selected.' };
  }
  try {
    const person = await getRecord<Person>('people', personId);
    const number = firstDialableNumber(person?.phones, person?.mobilePhone);
    const status = await getDoNotCallStatus(personId, number);
    return { ok: true as const, ...status };
  } catch {
    return { ok: false as const, message: 'Could not check Do Not Call status.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: CALL_CHECK_FUNCTION_ID,
  name: 'dialer-call-check',
  description: 'Tells the dialer panel whether a person may be called (Do Not Call check).',
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_CALL_CHECK,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
