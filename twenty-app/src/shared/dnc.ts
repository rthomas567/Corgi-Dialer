import { kv } from 'twenty-sdk/logic-function';

import {
  type CompanyRecord,
  DNC_LEAD_STATUS,
  DNC_OUTCOME,
  isCompanyDoNotCall,
  isPersonFlaggedDoNotCall,
  type PersonFlags,
} from 'src/shared/dnc-rules';
import { getRecord, listRecords } from 'src/shared/twenty-api';

// Same rules as src/shared/dnc-rules.ts, plus:
//  - anyone with a past dialer call saved as DNC is Do Not Call,
//  - any phone number that was ever saved as DNC is never dialed again,
//    whichever record it is on.
export { DNC_LEAD_STATUS, DNC_OUTCOME, isCompanyDoNotCall, type CompanyRecord };

type PersonRecord = PersonFlags & { id: string; companyId?: string | null };
type DialerCallRecord = { id: string; outcome?: string | null };

export type DoNotCallStatus = {
  doNotCall: boolean;
  scope: 'company' | 'person' | 'number' | null;
  reason: string | null;
  companyName: string | null;
};

const blockedNumberKey = (number: string) => `dnc-number:${number}`;

export const blockNumber = (number: string | null | undefined) =>
  number ? kv.set(blockedNumberKey(number), true) : Promise.resolve();

export const isNumberBlocked = async (number: string | null | undefined) =>
  number ? (await kv.get<boolean>(blockedNumberKey(number))) === true : false;

const companyBlocked = (company: CompanyRecord | null, companyName: string | null): DoNotCallStatus => ({
  doNotCall: true,
  scope: 'company',
  reason: `${companyName ?? 'This company'} is marked Do Not Call. Nobody at this company can be called from the dialer.`,
  companyName,
});

const NOT_BLOCKED = (companyName: string | null): DoNotCallStatus => ({
  doNotCall: false,
  scope: null,
  reason: null,
  companyName,
});

const hasPastDncCall = async (filter: string) => {
  const pastCalls = await listRecords<DialerCallRecord>('dialerCalls', filter);
  return pastCalls.some((call) => call.outcome === DNC_OUTCOME);
};

export const getDoNotCallStatus = async (
  personId: string,
  number?: string | null,
): Promise<DoNotCallStatus> => {
  const person = await getRecord<PersonRecord>('people', personId);
  const company = person?.companyId
    ? await getRecord<CompanyRecord>('companies', person.companyId)
    : null;
  const companyName = company?.name?.trim() || null;

  if (isCompanyDoNotCall(company)) {
    return companyBlocked(company, companyName);
  }

  if (isPersonFlaggedDoNotCall(person)) {
    return {
      doNotCall: true,
      scope: 'person',
      reason: 'This person is marked Do Not Call.',
      companyName,
    };
  }

  if (await hasPastDncCall(`personId[eq]:"${personId}"`)) {
    return {
      doNotCall: true,
      scope: 'person',
      reason: 'This person asked not to be called. A past call was saved as DNC.',
      companyName,
    };
  }

  if (await isNumberBlocked(number)) {
    return {
      doNotCall: true,
      scope: 'number',
      reason: 'This phone number was saved as DNC on an earlier call.',
      companyName,
    };
  }

  return NOT_BLOCKED(companyName);
};

// For dialing a company's main line directly.
export const getCompanyDoNotCallStatus = async (
  companyId: string,
  number?: string | null,
): Promise<DoNotCallStatus> => {
  const company = await getRecord<CompanyRecord>('companies', companyId);
  const companyName = company?.name?.trim() || null;

  if (isCompanyDoNotCall(company)) {
    return companyBlocked(company, companyName);
  }
  if (await hasPastDncCall(`companyId[eq]:"${companyId}"`)) {
    return companyBlocked(company, companyName);
  }
  if (await isNumberBlocked(number)) {
    return {
      doNotCall: true,
      scope: 'number',
      reason: 'This phone number was saved as DNC on an earlier call.',
      companyName,
    };
  }
  return NOT_BLOCKED(companyName);
};

// Local calendar date from the rep's browser, e.g. "2026-09-24".
export const isCalendarDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
