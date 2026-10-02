// Atlas documents the "detail" block on version-2 submission messages only as
// "the shared applicant and submitter information, every selected coverage with
// its status and quote". Its exact field names aren't published, so this reads
// it defensively: it looks for the most likely names anywhere in the block.
// Real messages are kept as samples (see store.ts) so these rules can be tightened.

export type SubmissionFacts = {
  insuredName: string | null;
  submitterEmail: string | null;
  submitterName: string | null;
  agencyName: string | null;
  quoteNumbers: string[];
  coverageSlugs: string[];
};

type Leaf = { path: string[]; key: string; value: unknown };

const walk = (value: unknown, path: string[] = [], out: Leaf[] = []): Leaf[] => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child !== null && typeof child === 'object') {
        walk(child, [...path, key.toLowerCase()], out);
      } else {
        out.push({ path, key: key.toLowerCase(), value: child });
      }
    }
  }
  return out;
};

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inSection = (leaf: Leaf, words: RegExp) => leaf.path.some((part) => words.test(part));

const SUBMITTER = /submitter|producer|agent|broker|submitted_by|contact/;
const APPLICANT = /applicant|insured|business|company|account|customer/;
const AGENCY = /agency|brokerage|firm|organization|organisation|org$/;

export const readSubmissionDetail = (detail: unknown): SubmissionFacts => {
  const leaves = walk(detail);

  const first = (match: (leaf: Leaf) => boolean) => {
    for (const leaf of leaves) {
      if (match(leaf)) {
        const value = text(leaf.value);
        if (value) {
          return value;
        }
      }
    }
    return null;
  };

  const insuredName =
    first((l) => /^(insured_name|named_insured|legal_name|business_name|applicant_name)$/.test(l.key)) ??
    first((l) => inSection(l, APPLICANT) && !inSection(l, SUBMITTER) && /^(name|company_name|dba)$/.test(l.key));

  const submitterEmail =
    first((l) => inSection(l, SUBMITTER) && /email/.test(l.key) && EMAIL.test(String(l.value))) ??
    first((l) => /^(submitter_email|producer_email|agent_email|broker_email)$/.test(l.key));

  const fullName = first((l) => inSection(l, SUBMITTER) && /^(name|full_name|display_name)$/.test(l.key));
  const firstName = first((l) => inSection(l, SUBMITTER) && /^first_?name$/.test(l.key));
  const lastName = first((l) => inSection(l, SUBMITTER) && /^last_?name$/.test(l.key));
  const submitterName = fullName ?? ([firstName, lastName].filter(Boolean).join(' ') || null);

  const agencyName =
    first((l) => /^(agency_name|brokerage_name|agency|brokerage|organization_name|firm_name)$/.test(l.key)) ??
    first((l) => inSection(l, AGENCY) && /^(name|legal_name|display_name)$/.test(l.key));

  const quoteNumbers = [
    ...new Set(
      leaves
        .filter((l) => /^(quote_number|source_quote_number)$/.test(l.key))
        .map((l) => text(l.value))
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const coverageSlugs = [
    ...new Set(
      leaves
        .filter((l) => /^(coverage_slug|slug)$/.test(l.key))
        .map((l) => text(l.value))
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  return { insuredName, submitterEmail, submitterName, agencyName, quoteNumbers, coverageSlugs };
};

export const emailDomain = (email: string | null | undefined) => {
  const domain = email?.split('@')[1]?.toLowerCase().trim();
  // Personal mailboxes say nothing about the agency.
  if (!domain || /^(gmail|yahoo|outlook|hotmail|icloud|aol|live|msn|proton(mail)?)\./.test(domain)) {
    return null;
  }
  return domain;
};
