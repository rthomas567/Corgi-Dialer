// Who counts as "Do Not Call". Kept free of server-only code so both the
// server and the on-screen boxes use the exact same rule.
//
// A company is Do Not Call when ANY of these is set on it:
//   DNC switch, "Do Not Call", "YC Company Do Not Call",
//   Lead Status = DNC, or Call Disposition = "Do not call (in progress)".
// A person is Do Not Call when any of the same flags is set on the person.
export const DNC_LEAD_STATUS = 'DNC';
export const DNC_OUTCOME = 'DNC';
export const DNC_CALL_DISPOSITION = 'DO_NOT_CALL_IN_PROGRESS';

export type CompanyRecord = {
  id: string;
  name?: string | null;
  dnc?: unknown;
  doNotCall?: unknown;
  ycCompanyDoNotCall?: unknown;
  leadStatus?: string | null;
  callDisposition?: string | null;
  lastContacted?: string | null;
};

export type PersonFlags = {
  doNotCall?: unknown;
  ycCompanyDoNotCall?: unknown;
  leadStatus?: string | null;
  callDisposition?: string | null;
};

const hasDncFlags = (record: (PersonFlags & { dnc?: unknown }) | null | undefined) =>
  record?.dnc === true ||
  record?.doNotCall === true ||
  record?.ycCompanyDoNotCall === true ||
  record?.leadStatus === DNC_LEAD_STATUS ||
  record?.callDisposition === DNC_CALL_DISPOSITION;

export const isCompanyDoNotCall = (company: CompanyRecord | null | undefined) =>
  hasDncFlags(company);

export const isPersonFlaggedDoNotCall = (person: PersonFlags | null | undefined) =>
  hasDncFlags(person);
