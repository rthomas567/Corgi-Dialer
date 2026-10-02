// How Atlas states become Opportunity fields.

export type OpportunityStage =
  | 'SUBMISSION_RECEIVED'
  | 'IN_REVIEW'
  | 'QUOTE_SENT'
  | 'NEGOTIATING'
  | 'BOUND'
  | 'CLOSED_LOST';

// Quote statuses (draft, submitted, needs_review, quoted, purchased, declined,
// under_review) and coverage statuses (draft, pending, review, referred, quoted,
// processing, bound, declined) from Atlas' contract.
export const stageForAtlasStatus = (status: string | undefined | null): OpportunityStage | null => {
  switch ((status ?? '').toLowerCase()) {
    case 'draft':
    case 'pending':
    case 'submitted':
      return 'SUBMISSION_RECEIVED';
    case 'review':
    case 'referred':
    case 'needs_review':
    case 'under_review':
    case 'processing':
      return 'IN_REVIEW';
    case 'quoted':
      return 'QUOTE_SENT';
    case 'bound':
    case 'purchased':
      return 'BOUND';
    case 'declined':
      return 'CLOSED_LOST';
    default:
      return null;
  }
};

const RANK: Record<string, number> = {
  SUBMISSION_RECEIVED: 1,
  IN_REVIEW: 2,
  QUOTE_SENT: 3,
  NEGOTIATING: 4,
  BOUND: 5,
};

// Stages only move forward, so a late or replayed Atlas message can't undo
// progress (including a stage a rep set by hand, like Negotiating).
// - BOUND is final.
// - Declined (Closed Lost) can close anything that isn't bound.
// - A closed-lost deal that Atlas re-quotes comes back to life.
export const nextStage = (
  current: string | null | undefined,
  incoming: OpportunityStage | null,
): OpportunityStage | null => {
  if (!incoming || incoming === current) {
    return null;
  }
  if (current === 'BOUND') {
    return null;
  }
  if (incoming === 'CLOSED_LOST') {
    return 'CLOSED_LOST';
  }
  if (current === 'CLOSED_LOST') {
    return incoming;
  }
  const currentRank = current ? (RANK[current] ?? 0) : 0;
  return RANK[incoming] > currentRank ? incoming : null;
};

// Atlas coverage slugs -> the Coverages Requested options in Twenty.
const COVERAGE_RULES: Array<[RegExp, string]> = [
  [/(^|_)gl($|_)|general_?liab/, 'GL'],
  [/commercial_?prop/, 'COMMERCIAL_PROPERTY'],
  [/residential_?prop|homeowner/, 'RESIDENTIAL_PROPERTY'],
  [/hoa|coa|community_?assoc|condo/, 'HOA_COA'],
  [/inland_?marine/, 'INLAND_MARINE'],
  [/landlord|dp3|dwelling/, 'LANDLORDS_INSURANCE_DP3'],
  [/(^|_)d_?(and_)?o($|_)|directors/, 'D_O'],
  [/(^|_)e_?(and_)?o($|_)|errors|professional_?liab|tech_?e/, 'E_O'],
  [/cyber/, 'CYBER'],
  [/crime|fidelity/, 'CRIME_FIDELITY'],
  [/umbrella|excess/, 'UMBRELLA'],
  [/liquor/, 'LIQUOR_LIABILITY'],
  [/(^|_)bop($|_)|business_?owner/, 'BOP'],
  [/short_?term|str($|_)/, 'SHORT_TERM_RENTAL'],
  [/commercial_?auto|(^|_)auto($|_)/, 'COMMERCIAL_AUTO'],
  [/garage/, 'GARAGEKEEPERS'],
  [/builder/, 'BUILDERS_RISK'],
  [/business_?income|bi($|_)/, 'BUSINESS_INCOME'],
];

export const coveragesForSlugs = (slugs: ReadonlyArray<string | undefined>): string[] => {
  const found = new Set<string>();
  for (const slug of slugs) {
    const normalized = (slug ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    for (const [pattern, value] of COVERAGE_RULES) {
      if (pattern.test(normalized)) {
        found.add(value);
        break;
      }
    }
  }
  return [...found];
};

// Atlas sends money as exact decimal strings ("1234.56").
export const premiumToAmount = (premium: string | undefined | null) => {
  const value = premium?.trim();
  if (!value || !/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }
  return { amountMicros: Math.round(Number(value) * 100) * 10_000, currencyCode: 'USD' };
};

export const atlasQuoteUrl = (quoteNumber: string) =>
  `https://v2.atlas.corgi.insure/quotes/${encodeURIComponent(quoteNumber)}`;
