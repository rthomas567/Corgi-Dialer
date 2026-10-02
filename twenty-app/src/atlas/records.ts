import { RestApiClient } from 'twenty-client-sdk/rest';

// Twenty reads/writes for the Atlas sync. Atlas messages aren't from a signed-in
// person, so these run as the app itself.

const client = () => new RestApiClient({ runAs: 'application' });

const unwrapOne = <T>(response: unknown): T | null => {
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  if (!data) return null;
  const value = Object.values(data)[0];
  return (value as T) ?? null;
};

const unwrapList = <T>(response: unknown): T[] => {
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  const list = data ? Object.values(data).find(Array.isArray) : undefined;
  return (list as T[]) ?? [];
};

const quoteFilterValue = (value: string) => value.replace(/["\\]/g, '');

export type OpportunityRecord = {
  id: string;
  name?: string | null;
  stage?: string | null;
  atlasQuoteNumbers?: string | null;
  insuredName?: string | null;
  companyId?: string | null;
  producerId?: string | null;
};

export const getOpportunity = async (id: string) =>
  unwrapOne<OpportunityRecord>(await client().get(`/rest/opportunities/${id}`).catch(() => null));

export const findOpportunityByQuote = async (quoteNumber: string) => {
  const list = unwrapList<OpportunityRecord>(
    await client().get('/rest/opportunities', {
      query: { filter: `atlasQuoteNumbers[ilike]:"%${quoteFilterValue(quoteNumber)}%"`, limit: 5 },
    }),
  );
  // ilike is a substring match; make sure it's the exact number in the list.
  return (
    list.find((opp) =>
      (opp.atlasQuoteNumbers ?? '')
        .split(',')
        .map((part) => part.trim())
        .includes(quoteNumber),
    ) ?? null
  );
};

export const createOpportunity = async (data: Record<string, unknown>) =>
  unwrapOne<OpportunityRecord>(await client().post('/rest/opportunities', data));

export const updateOpportunity = async (id: string, data: Record<string, unknown>) =>
  unwrapOne<OpportunityRecord>(await client().patch(`/rest/opportunities/${id}`, data));

type IdRecord = { id: string };

export const findPersonByEmail = async (email: string) =>
  unwrapList<IdRecord>(
    await client().get('/rest/people', {
      query: { filter: `emails.primaryEmail[ilike]:"${quoteFilterValue(email)}"`, limit: 1 },
    }),
  )[0] ?? null;

export const findCompanyByDomain = async (domain: string) =>
  unwrapList<IdRecord>(
    await client().get('/rest/companies', {
      query: { filter: `domainName.primaryLinkUrl[ilike]:"%${quoteFilterValue(domain)}%"`, limit: 1 },
    }),
  )[0] ?? null;

export const findCompanyByName = async (name: string) =>
  unwrapList<IdRecord>(
    await client().get('/rest/companies', {
      query: { filter: `name[ilike]:"${quoteFilterValue(name)}"`, limit: 1 },
    }),
  )[0] ?? null;

export const createCompany = async (data: Record<string, unknown>) =>
  unwrapOne<IdRecord>(await client().post('/rest/companies', data));

export const createPerson = async (data: Record<string, unknown>) =>
  unwrapOne<IdRecord>(await client().post('/rest/people', data));
