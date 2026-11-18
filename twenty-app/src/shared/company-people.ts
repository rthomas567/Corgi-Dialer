import { isCompanyDoNotCall, isPersonFlaggedDoNotCall, type CompanyRecord, type PersonFlags } from 'src/shared/dnc-rules';
import { firstDialableNumber, type TwentyPhones } from 'src/shared/phone';

export const MAX_COMPANIES_FOR_PEOPLE = 50;
export const MAX_PEOPLE_PER_COMPANY = 100;

export type RawCompany = CompanyRecord & {
  phone?: TwentyPhones;
  companyPhone?: TwentyPhones;
};

export type RawPerson = PersonFlags & {
  id: string;
  companyId?: string | null;
  name?: { firstName?: string; lastName?: string } | null;
  jobTitle?: string | null;
  phones?: TwentyPhones;
  mobilePhone?: TwentyPhones;
  emails?: { primaryEmail?: string | null } | null;
  city?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
};

export type CompanyPerson = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  linkedin: string | null;
  doNotCall: boolean;
};

export type CompanyWithPeople = {
  id: string;
  name: string;
  phone: string | null;
  doNotCall: boolean;
  people: CompanyPerson[];
};

const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

// Turns raw Twenty records into what the dialer's Companies / People tabs show.
// Everyone at a Do Not Call company is shown as Do Not Call too.
export const shapeCompanyPeople = (
  companies: RawCompany[],
  people: RawPerson[],
): CompanyWithPeople[] =>
  companies.map((company) => {
    const companyDnc = isCompanyDoNotCall(company);
    return {
      id: company.id,
      name: text(company.name) ?? 'Unknown company',
      phone: firstDialableNumber(company.phone, company.companyPhone),
      doNotCall: companyDnc,
      people: people
        .filter((person) => person.companyId === company.id)
        .map((person) => ({
          id: person.id,
          name:
            [person.name?.firstName, person.name?.lastName].filter(Boolean).join(' ').trim() ||
            'Unknown person',
          jobTitle: text(person.jobTitle),
          phone: firstDialableNumber(person.phones, person.mobilePhone),
          email: text(person.emails?.primaryEmail),
          city: text(person.city),
          linkedin: text(person.linkedinLink?.primaryLinkUrl),
          doNotCall: companyDnc || isPersonFlaggedDoNotCall(person),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
