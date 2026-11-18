import { describe, expect, it, vi } from 'vitest';

const records: Record<string, any> = {
  'companies:c1': { id: 'c1', name: 'Acme Insurance', phone: { primaryPhoneNumber: '3125550100', primaryPhoneCallingCode: '+1' } },
  'companies:c2': { id: 'c2', name: 'Empty Co', companyPhone: { primaryPhoneNumber: '3125550111', primaryPhoneCallingCode: '+1' } },
  'companies:c3': { id: 'c3', name: 'Blocked Co', dnc: true },
};
const peopleByCompany: Record<string, any[]> = {
  c1: [
    { id: 'p2', companyId: 'c1', name: { firstName: 'Zoe', lastName: 'Lee' }, jobTitle: 'Owner', phones: { primaryPhoneNumber: '5550001001', primaryPhoneCallingCode: '+1' }, emails: { primaryEmail: 'zoe@acme.com' } },
    { id: 'p1', companyId: 'c1', name: { firstName: 'Al', lastName: 'Bo' }, jobTitle: '', mobilePhone: { primaryPhoneNumber: '5550001002', primaryPhoneCallingCode: '+1' }, doNotCall: true },
  ],
  c2: [],
  c3: [{ id: 'p3', companyId: 'c3', name: { firstName: 'Cy' }, phones: { primaryPhoneNumber: '5550001003', primaryPhoneCallingCode: '+1' } }],
};

vi.mock('src/shared/twenty-api', () => ({
  getRecord: async (object: string, id: string) => records[`${object}:${id}`] ?? null,
  listRecords: async (_object: string, filter: string) => peopleByCompany[filter.match(/"(.+)"/)![1]] ?? [],
}));

import companyPeople from 'src/logic-functions/company-people.logic-function';

const run = (body: unknown) =>
  (companyPeople.config.handler as any)({ body, headers: {} }, { workspaceMemberId: 'rep-1' });

describe('company dialer People tab', () => {
  it('lists each company with its phone and its people, sorted, with job titles', async () => {
    const result = await run({ companyIds: ['c1', 'c2', 'c3'] });
    expect(result.ok).toBe(true);
    const [acme, empty, blocked] = result.companies;

    expect(acme).toMatchObject({ name: 'Acme Insurance', phone: '+13125550100', doNotCall: false });
    expect(acme.people.map((p: any) => p.name)).toEqual(['Al Bo', 'Zoe Lee']);
    expect(acme.people[1]).toMatchObject({ jobTitle: 'Owner', phone: '+15550001001', email: 'zoe@acme.com', doNotCall: false });
    expect(acme.people[0]).toMatchObject({ jobTitle: null, phone: '+15550001002', doNotCall: true });

    // No people: the screen shows "There are no people associated with this company."
    expect(empty).toMatchObject({ phone: '+13125550111', people: [] });

    // Everyone at a DNC company is DNC.
    expect(blocked.doNotCall).toBe(true);
    expect(blocked.people[0].doNotCall).toBe(true);
  });

  it('skips companies that no longer exist', async () => {
    const result = await run({ companyIds: ['c1', 'gone'] });
    expect(result.companies).toHaveLength(1);
  });
});
