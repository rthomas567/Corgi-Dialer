import { RestApiClient } from 'twenty-client-sdk/rest';

type RunAs = 'user' | 'application';

// Twenty's REST API wraps a single record as { data: { person: {...} } }.
const unwrapRecord = <T>(response: unknown): T | null => {
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object') {
    return null;
  }
  const first = Object.values(data).find(
    (value) => value && typeof value === 'object' && 'id' in (value as object),
  );
  return (first as T) ?? null;
};

export const createRecord = async <T>(
  objectNamePlural: string,
  data: Record<string, unknown>,
): Promise<T | null> => {
  const response = await new RestApiClient({ runAs: 'user' }).post(`/rest/${objectNamePlural}`, data);
  return unwrapRecord<T>(response);
};

export const updateRecord = async <T>(
  objectNamePlural: string,
  id: string,
  data: Record<string, unknown>,
  runAs: RunAs = 'user',
): Promise<T | null> => {
  const response = await new RestApiClient({ runAs }).patch(`/rest/${objectNamePlural}/${id}`, data);
  return unwrapRecord<T>(response);
};

// Twenty's REST API wraps a list as { data: { dialerCalls: [...] } }.
export const listRecords = async <T>(
  objectNamePlural: string,
  filter: string,
  limit = 60,
): Promise<T[]> => {
  const response = await new RestApiClient({ runAs: 'user' }).get(`/rest/${objectNamePlural}`, {
    query: { filter, limit },
  });
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  const list = data ? Object.values(data).find(Array.isArray) : undefined;
  return (list as T[]) ?? [];
};

export const getRecord = async <T>(
  objectNamePlural: string,
  id: string,
  runAs: RunAs = 'user',
): Promise<T | null> => {
  const client = new RestApiClient({ runAs });
  const response = await client.get(`/rest/${objectNamePlural}/${id}`);
  return unwrapRecord<T>(response);
};

// Where Twilio should send its updates for this app.
export const functionsBaseUrl = () =>
  process.env.TWENTY_FUNCTIONS_URL || `${process.env.TWENTY_API_URL}/s`;
