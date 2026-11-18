import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import {
  COMPANY_PEOPLE_FUNCTION_ID,
  ROUTE_COMPANY_PEOPLE,
} from 'src/constants/universal-identifiers';
import {
  MAX_COMPANIES_FOR_PEOPLE,
  MAX_PEOPLE_PER_COMPANY,
  type RawCompany,
  type RawPerson,
  shapeCompanyPeople,
} from 'src/shared/company-people';
import { readJsonBody } from 'src/shared/route-body';
import { getRecord, listRecords } from 'src/shared/twenty-api';

// The dialer's Companies and People tabs: each selected company with its
// main phone number, and everyone who works there (job title, phone, email).
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return { ok: false as const, message: 'Not signed in.' };
  }
  const { companyIds } = readJsonBody<{ companyIds: unknown }>(event);
  const ids = Array.isArray(companyIds)
    ? [...new Set(companyIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const shown = ids.slice(0, MAX_COMPANIES_FOR_PEOPLE);

  const companies = (
    await Promise.all(shown.map((id) => getRecord<RawCompany>('companies', id).catch(() => null)))
  ).filter((company): company is RawCompany => Boolean(company));

  const people = (
    await Promise.all(
      companies.map((company) =>
        listRecords<RawPerson>('people', `companyId[eq]:"${company.id}"`, MAX_PEOPLE_PER_COMPANY).catch(
          () => [] as RawPerson[],
        ),
      ),
    )
  ).flat();

  return {
    ok: true as const,
    companies: shapeCompanyPeople(companies, people),
    notShown: ids.length - shown.length,
  };
};

export default defineLogicFunction({
  universalIdentifier: COMPANY_PEOPLE_FUNCTION_ID,
  name: 'dialer-company-people',
  description: 'Lists the selected companies and the people at each one, for the dialer.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_COMPANY_PEOPLE,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
