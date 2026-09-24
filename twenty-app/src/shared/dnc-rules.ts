// A company is "Do Not Call" when its DNC switch is on OR its Lead Status is DNC.
// Kept free of server-only code so both the server and the on-screen boxes use
// the exact same rule.
export const DNC_LEAD_STATUS = 'DNC';
export const DNC_OUTCOME = 'DNC';

export type CompanyRecord = {
  id: string;
  name?: string | null;
  dnc?: unknown;
  leadStatus?: string | null;
  lastContacted?: string | null;
};

export const isCompanyDoNotCall = (company: CompanyRecord | null | undefined) =>
  company?.dnc === true || company?.leadStatus === DNC_LEAD_STATUS;
