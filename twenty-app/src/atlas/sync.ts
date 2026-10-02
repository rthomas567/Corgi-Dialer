import { fetchAtlasQuote } from 'src/atlas/atlas-api';
import { emailDomain, readSubmissionDetail, type SubmissionFacts } from 'src/atlas/detail';
import {
  atlasQuoteUrl,
  coveragesForSlugs,
  nextStage,
  premiumToAmount,
  stageForAtlasStatus,
} from 'src/atlas/mapping';
import {
  createCompany,
  createOpportunity,
  createPerson,
  findCompanyByDomain,
  findCompanyByName,
  findOpportunityByQuote,
  findPersonByEmail,
  getOpportunity,
  type OpportunityRecord,
  updateOpportunity,
} from 'src/atlas/records';
import {
  addPending,
  claimQuote,
  clearPending,
  getPending,
  lastPricingRevision,
  oppForQuote,
  type PendingQuoteUpdate,
  releaseQuote,
  rememberOppForQuote,
  setPricingRevision,
} from 'src/atlas/store';

export type AtlasEnvelope = {
  id: string;
  type: string;
  created_at?: string;
  environment?: string;
  data?: Record<string, unknown>;
};

// Thrown when a message should be retried a little later (Atlas retries on any non-2xx).
export class RetryLater extends Error {}

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const PLACEHOLDER_PREFIX = 'Atlas quote ';

const opportunityName = (quoteNumber: string, facts: PendingQuoteUpdate['facts'] = {}) => {
  const insured = facts?.insuredName;
  const agency = facts?.agencyName;
  if (insured && agency) return `${insured} - ${agency}`;
  if (insured) return insured;
  return `${PLACEHOLDER_PREFIX}${quoteNumber}`;
};

// Find (or create) the agency Company and the producer Person.
const resolveParties = async (facts: PendingQuoteUpdate['facts'] = {}) => {
  let companyId: string | null = null;
  const domain = emailDomain(facts?.submitterEmail);
  if (domain) companyId = (await findCompanyByDomain(domain))?.id ?? null;
  if (!companyId && facts?.agencyName) companyId = (await findCompanyByName(facts.agencyName))?.id ?? null;
  if (!companyId && (facts?.agencyName || domain)) {
    companyId =
      (
        await createCompany({
          name: facts?.agencyName ?? domain,
          ...(domain ? { domainName: { primaryLinkUrl: `https://${domain}`, primaryLinkLabel: '', secondaryLinks: [] } } : {}),
        })
      )?.id ?? null;
  }

  let producerId: string | null = null;
  if (facts?.submitterEmail) {
    producerId = (await findPersonByEmail(facts.submitterEmail))?.id ?? null;
    if (!producerId) {
      const [firstName, ...rest] = (facts.submitterName ?? facts.submitterEmail.split('@')[0]).split(' ');
      producerId =
        (
          await createPerson({
            name: { firstName, lastName: rest.join(' ') },
            emails: { primaryEmail: facts.submitterEmail, additionalEmails: [] },
            ...(companyId ? { companyId } : {}),
          })
        )?.id ?? null;
    }
  }
  return { companyId, producerId };
};

const lookupOpportunity = async (quoteNumber: string): Promise<OpportunityRecord | null> => {
  const rememberedId = await oppForQuote(quoteNumber);
  if (rememberedId) {
    const opp = await getOpportunity(rememberedId);
    if (opp) return opp;
  }
  const found = await findOpportunityByQuote(quoteNumber);
  if (found) await rememberOppForQuote(quoteNumber, found.id);
  return found;
};

// Fill in facts the Opportunity doesn't have yet. Never overwrites what a person entered.
const applyFacts = async (
  opp: OpportunityRecord,
  quoteNumber: string,
  update: PendingQuoteUpdate,
) => {
  const facts = update.facts ?? {};
  const changes: Record<string, unknown> = {};
  if (facts.insuredName && !opp.insuredName) changes.insuredName = facts.insuredName;
  if ((opp.name ?? '').startsWith(PLACEHOLDER_PREFIX) && facts.insuredName) {
    changes.name = opportunityName(quoteNumber, facts);
  }
  if ((!opp.companyId || !opp.producerId) && (facts.submitterEmail || facts.agencyName)) {
    const parties = await resolveParties(facts);
    if (!opp.companyId && parties.companyId) changes.companyId = parties.companyId;
    if (!opp.producerId && parties.producerId) changes.producerId = parties.producerId;
  }
  if (update.submissionNumber) changes.atlasSubmissionNumber = update.submissionNumber;
  if (Object.keys(changes).length > 0) await updateOpportunity(opp.id, changes);
};

const applyStage = async (opp: OpportunityRecord, status: string | undefined, eventDate?: string) => {
  const stage = nextStage(opp.stage, stageForAtlasStatus(status));
  if (!stage) return;
  const changes: Record<string, unknown> = { stage };
  if (stage === 'BOUND') changes.boundDate = (eventDate ?? new Date().toISOString()).slice(0, 10);
  await updateOpportunity(opp.id, changes);
  opp.stage = stage;
};

const applyPremium = async (opp: OpportunityRecord, quoteNumber: string, premium?: string, revision?: number) => {
  if (revision !== undefined) {
    const last = await lastPricingRevision(quoteNumber);
    if (last !== null && revision <= last) return; // a replay or an older price
  }
  const amount = premiumToAmount(premium);
  if (!amount) return;
  await updateOpportunity(opp.id, { amount });
  if (revision !== undefined) await setPricingRevision(quoteNumber, revision);
};

// Find the quote's Opportunity, creating it if this is the first we've heard of it.
const ensureOpportunity = async (
  quoteNumber: string,
  eventId: string,
  initial: { status?: string; submissionNumber?: string; coverageSlug?: string },
): Promise<OpportunityRecord> => {
  const existing = await lookupOpportunity(quoteNumber);
  if (existing) return existing;

  if (!(await claimQuote(quoteNumber, eventId))) {
    throw new RetryLater(`Opportunity for ${quoteNumber} is being created`);
  }
  try {
    const pending = (await getPending(quoteNumber)) ?? {};
    const lookedUp = await fetchAtlasQuote(quoteNumber);
    const facts = { ...(pending.facts ?? {}) };
    if (!facts.insuredName && lookedUp?.insured_name) facts.insuredName = lookedUp.insured_name;
    const slugs = [
      ...(facts.coverageSlugs ?? []),
      ...(lookedUp?.coverage_slugs ?? []),
      ...(initial.coverageSlug ? [initial.coverageSlug] : []),
    ];
    const parties = await resolveParties(facts);
    const stage =
      stageForAtlasStatus(initial.status ?? pending.stageStatus ?? lookedUp?.status) ?? 'SUBMISSION_RECEIVED';
    const amount = premiumToAmount(pending.premium ?? lookedUp?.premium);
    const submissionNumber = initial.submissionNumber ?? pending.submissionNumber;

    const created = await createOpportunity({
      name: opportunityName(quoteNumber, facts),
      stage,
      pipeline: 'PARTNER', // shown as "BROKERED"
      leadSource: 'BROKER',
      atlasQuoteNumbers: quoteNumber,
      atlasQuoteLink: { primaryLinkUrl: atlasQuoteUrl(quoteNumber), primaryLinkLabel: quoteNumber, secondaryLinks: [] },
      ...(facts.insuredName ? { insuredName: facts.insuredName } : {}),
      ...(submissionNumber ? { atlasSubmissionNumber: submissionNumber } : {}),
      ...(parties.companyId ? { companyId: parties.companyId } : {}),
      ...(parties.producerId ? { producerId: parties.producerId } : {}),
      ...(amount ? { amount } : {}),
      ...(coveragesForSlugs(slugs).length ? { coveragesRequested: coveragesForSlugs(slugs) } : {}),
    });
    if (!created?.id) throw new Error(`Twenty did not create an Opportunity for ${quoteNumber}`);
    await rememberOppForQuote(quoteNumber, created.id);
    if (pending.pricingRevision !== undefined) await setPricingRevision(quoteNumber, pending.pricingRevision);
    await clearPending(quoteNumber);
    return { ...created, stage };
  } finally {
    await releaseQuote(quoteNumber);
  }
};

const factsFrom = (facts: SubmissionFacts): PendingQuoteUpdate['facts'] => ({
  insuredName: facts.insuredName,
  submitterEmail: facts.submitterEmail,
  submitterName: facts.submitterName,
  agencyName: facts.agencyName,
  coverageSlugs: facts.coverageSlugs,
});

export type SyncResult = { action: string; quoteNumbers: string[] };

export const handleAtlasEvent = async (envelope: AtlasEnvelope): Promise<SyncResult> => {
  const data = envelope.data ?? {};
  const eventDate = envelope.created_at;

  switch (envelope.type) {
    case 'ping':
      return { action: 'ping', quoteNumbers: [] };

    // A quote appeared or moved: create its Opportunity if new, then move the stage.
    case 'quote.status_changed': {
      const quoteNumber = str(data.quote_number);
      if (!quoteNumber) return { action: 'ignored', quoteNumbers: [] };
      const status = str(data.to_status);
      const opp = await ensureOpportunity(quoteNumber, envelope.id, { status });
      await applyStage(opp, status, eventDate);
      return { action: 'quote-status', quoteNumbers: [quoteNumber] };
    }

    // The price moved (with or without a status change): update Amount, newest revision wins.
    case 'quote.pricing_changed': {
      const quoteNumber = str(data.source_quote_number) ?? str(data.quote_number);
      if (!quoteNumber) return { action: 'ignored', quoteNumbers: [] };
      const premium = str(data.premium);
      const revision = typeof data.revision === 'number' ? data.revision : undefined;
      const opp = await lookupOpportunity(quoteNumber);
      if (opp) await applyPremium(opp, quoteNumber, premium, revision);
      else await addPending(quoteNumber, { premium, pricingRevision: revision });
      return { action: opp ? 'premium' : 'premium-pending', quoteNumbers: [quoteNumber] };
    }

    // One coverage on a submission moved; it names the quote that answers it.
    case 'submission.coverage_changed': {
      const quoteNumber = str(data.quote_number);
      const submissionNumber = str(data.submission_number);
      if (!quoteNumber) return { action: 'ignored-no-quote-yet', quoteNumbers: [] };
      const status = str(data.to_status);
      const opp = await ensureOpportunity(quoteNumber, envelope.id, {
        status,
        submissionNumber,
        coverageSlug: str(data.coverage_slug),
      });
      await applyStage(opp, status, eventDate);
      if (submissionNumber) await applyFacts(opp, quoteNumber, { submissionNumber });
      return { action: 'coverage-status', quoteNumbers: [quoteNumber] };
    }

    // The whole submission (version-2 webhooks carry the details): fill in insured,
    // agency and producer on every quote it names.
    case 'submission.status_changed': {
      const submissionNumber = str(data.submission_number);
      const facts = readSubmissionDetail(data.detail);
      const update: PendingQuoteUpdate = { submissionNumber, facts: factsFrom(facts) };
      for (const quoteNumber of facts.quoteNumbers) {
        const opp = await lookupOpportunity(quoteNumber);
        if (opp) await applyFacts(opp, quoteNumber, update);
        else await addPending(quoteNumber, update);
      }
      return { action: 'submission-details', quoteNumbers: facts.quoteNumbers };
    }

    // Bound.
    case 'policy.issued': {
      const quoteNumber = str(data.quote_number);
      if (!quoteNumber) return { action: 'ignored', quoteNumbers: [] };
      const opp = await ensureOpportunity(quoteNumber, envelope.id, { status: 'bound' });
      await applyStage(opp, 'bound', eventDate);
      return { action: 'bound', quoteNumbers: [quoteNumber] };
    }

    default:
      return { action: 'ignored', quoteNumbers: [] };
  }
};
