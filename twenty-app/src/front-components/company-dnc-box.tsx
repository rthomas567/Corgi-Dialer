import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { useTheme } from 'twenty-ui/theme-constants';

import { DncAlert } from 'src/components/dnc-alert';
import { COMPANY_DNC_BOX_FRONT_COMPONENT_ID } from 'src/constants/universal-identifiers';
import { type CompanyRecord, isCompanyDoNotCall } from 'src/shared/dnc-rules';

// Checks again every so often, so turning DNC on or off shows up without a refresh.
const RECHECK_MS = 15000;

const unwrapCompany = (response: unknown): CompanyRecord | null => {
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  const company = data?.company ?? Object.values(data ?? {})[0];
  return (company as CompanyRecord) ?? null;
};

// Top of each company's page: a big red DO NOT CALL block when the company is
// Do Not Call, otherwise a short "OK to call" line.
const CompanyDncBox = () => {
  const theme = useTheme();
  const companyId = useRecordId();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!companyId) {
      return;
    }
    let cancelled = false;
    const load = () =>
      new RestApiClient()
        .get(`/rest/companies/${companyId}`)
        .then((response) => {
          if (!cancelled) {
            setCompany(unwrapCompany(response));
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFailed(true);
          }
        });
    void load();
    const timer = setInterval(load, RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [companyId]);

  const quiet = {
    margin: 0,
    padding: theme.spacing[3],
    fontFamily: theme.font.family,
    fontSize: theme.font.size.md,
    color: theme.font.color.tertiary,
  };

  if (!companyId || failed) {
    return <p style={quiet}>Couldn't check Do Not Call status.</p>;
  }
  if (!company) {
    return <p style={quiet}>Checking Do Not Call status…</p>;
  }
  if (isCompanyDoNotCall(company)) {
    const name = company.name?.trim() || 'This company';
    return (
      <div style={{ padding: theme.spacing[2] }}>
        <DncAlert
          scope="company"
          message={`${name} is marked Do Not Call. Nobody at this company can be called from the dialer, by anyone on the team.`}
        />
      </div>
    );
  }
  return <p style={quiet}>Not marked Do Not Call. Call people from their own pages.</p>;
};

export default defineFrontComponent({
  universalIdentifier: COMPANY_DNC_BOX_FRONT_COMPONENT_ID,
  name: 'company-dnc-box',
  description: 'Big red DO NOT CALL warning at the top of Do Not Call companies.',
  component: CompanyDncBox,
});
