import { getRecord, listRecords } from 'src/shared/twenty-api';

// A company is "Do Not Call" when its DNC switch is on OR its Lead Status is DNC.
// A person with no company is Do Not Call if any of their past dialer calls
// was saved with the DNC outcome.
export const DNC_LEAD_STATUS = 'DNC';
export const DNC_OUTCOME = 'DNC';

export type CompanyRecord = {
  id: string;
  name?: string | null;
  dnc?: unknown;
  leadStatus?: string | null;
  lastContacted?: string | null;
};

type PersonRecord = { id: string; companyId?: string | null };
type DialerCallRecord = { id: string; outcome?: string | null };

export type DoNotCallStatus = {
  doNotCall: boolean;
  reason: string | null;
  companyName: string | null;
};

export const isCompanyDoNotCall = (company: CompanyRecord | null | undefined) =>
  company?.dnc === true || company?.leadStatus === DNC_LEAD_STATUS;

export const getDoNotCallStatus = async (personId: string): Promise<DoNotCallStatus> => {
  const person = await getRecord<PersonRecord>('people', personId);
  const company = person?.companyId
    ? await getRecord<CompanyRecord>('companies', person.companyId)
    : null;
  const companyName = company?.name?.trim() || null;

  if (isCompanyDoNotCall(company)) {
    return {
      doNotCall: true,
      reason: `${companyName ?? 'This company'} is marked Do Not Call. Nobody at this company can be called from the dialer.`,
      companyName,
    };
  }

  const pastCalls = await listRecords<DialerCallRecord>(
    'dialerCalls',
    `personId[eq]:"${personId}"`,
  );
  if (pastCalls.some((call) => call.outcome === DNC_OUTCOME)) {
    return {
      doNotCall: true,
      reason: 'This person asked not to be called. A past call was saved as DNC.',
      companyName,
    };
  }

  return { doNotCall: false, reason: null, companyName };
};

// Local calendar date from the rep's browser, e.g. "2026-09-24".
export const isCalendarDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
