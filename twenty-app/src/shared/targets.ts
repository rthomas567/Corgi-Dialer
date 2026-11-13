import { getCompanyDoNotCallStatus, getDoNotCallStatus } from 'src/shared/dnc';
import { firstDialableNumber, type TwentyPhones } from 'src/shared/phone';
import type { SessionTarget, TargetResult } from 'src/shared/session-store';
import { getRecord } from 'src/shared/twenty-api';

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
  phones?: TwentyPhones;
  mobilePhone?: TwentyPhones;
  companyId?: string | null;
};
type Company = {
  id: string;
  name?: string | null;
  phone?: TwentyPhones;
  companyPhone?: TwentyPhones;
};
type QueueItem = { id: string; personId?: string | null; companyId?: string | null };

export const personName = (person: Person | null | undefined) =>
  [person?.name?.firstName, person?.name?.lastName].filter(Boolean).join(' ').trim() ||
  'Unknown person';

// Works out who a list entry is, what number to dial, and whether it may be
// called at all. Every entry is checked against Do Not Call right before it
// is dialed, so a company marked DNC mid-session is never called.
export const resolveTarget = async (
  target: SessionTarget,
  index: number,
): Promise<TargetResult> => {
  let personId: string | null = null;
  let companyId: string | null = null;
  let queueItemId: string | null = null;

  if (target.kind === 'queue') {
    queueItemId = target.id;
    const item = await getRecord<QueueItem>('callQueueItems', target.id);
    personId = item?.personId ?? null;
    companyId = item?.companyId ?? null;
  } else if (target.kind === 'person') {
    personId = target.id;
  } else {
    companyId = target.id;
  }

  const base = {
    index,
    kind: target.kind,
    id: target.id,
    queueItemId,
  };

  // A person: dial their own number, falling back to their mobile.
  if (personId) {
    const person = await getRecord<Person>('people', personId);
    if (!person) {
      return {
        ...base, personId, companyId, name: 'Unknown person', companyName: null,
        number: null, status: 'skipped-no-number', reason: 'Record not found.',
      };
    }
    const number = firstDialableNumber(person.phones, person.mobilePhone);
    const dnc = await getDoNotCallStatus(person.id, number);
    const result = {
      ...base,
      personId: person.id,
      companyId: person.companyId ?? companyId,
      name: personName(person),
      companyName: dnc.companyName,
      number,
    };
    if (dnc.doNotCall) {
      return { ...result, status: 'skipped-dnc', reason: dnc.reason ?? 'Do Not Call.' };
    }
    if (!number) {
      return { ...result, status: 'skipped-no-number', reason: 'No phone number.' };
    }
    return { ...result, status: 'dialing' };
  }

  // A company: dial its main line.
  if (companyId) {
    const company = await getRecord<Company>('companies', companyId);
    const number = firstDialableNumber(company?.phone, company?.companyPhone);
    const dnc = await getCompanyDoNotCallStatus(companyId, number);
    const name = company?.name?.trim() || 'Unknown company';
    const result = {
      ...base, personId: null, companyId, name, companyName: name, number,
    };
    if (!company) {
      return { ...result, status: 'skipped-no-number', reason: 'Record not found.' };
    }
    if (dnc.doNotCall) {
      return { ...result, status: 'skipped-dnc', reason: dnc.reason ?? 'Do Not Call.' };
    }
    if (!number) {
      return { ...result, status: 'skipped-no-number', reason: 'No phone number.' };
    }
    return { ...result, status: 'dialing' };
  }

  return {
    ...base, personId: null, companyId: null, name: 'Empty queue entry', companyName: null,
    number: null, status: 'skipped-no-number', reason: 'No person or company on this entry.',
  };
};
