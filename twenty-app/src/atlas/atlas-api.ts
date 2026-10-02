// Optional lookups against Atlas' Partner API with the Atlas key.
// A partner key only sees that partner's own quotes, so a failed lookup is normal
// and never stops the sync.

const ATLAS_API_BASE = 'https://v2.api.corgi.insure/api/partner/v1';

export type AtlasQuote = {
  quote_number?: string;
  insured_name?: string;
  premium?: string;
  status?: string;
  coverage_slugs?: string[];
};

export const fetchAtlasQuote = async (quoteNumber: string): Promise<AtlasQuote | null> => {
  const apiKey = (process.env.ATLAS_API_KEY ?? '').trim();
  if (!apiKey) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${ATLAS_API_BASE}/quotes/${encodeURIComponent(quoteNumber)}`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { success?: boolean; data?: AtlasQuote };
    return body?.success ? (body.data ?? null) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
