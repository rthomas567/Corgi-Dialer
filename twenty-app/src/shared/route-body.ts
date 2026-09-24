import type { RoutePayload } from 'twenty-sdk/logic-function';

// SignalWire sends its updates as a web form (key=value&key=value).
// Depending on how Twenty hands the request over, it may arrive already
// parsed or as raw text, so handle both.
export const readFormBody = (event: RoutePayload): Record<string, string> => {
  const result: Record<string, string> = {};

  if (event.body && typeof event.body === 'object') {
    for (const [key, value] of Object.entries(event.body)) {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
  }

  const raw = event.rawBody ?? (typeof event.body === 'string' ? event.body : '');
  if (!raw) {
    return result;
  }

  const text = event.isBase64Encoded
    ? Buffer.from(raw, 'base64').toString('utf8')
    : raw;

  for (const [key, value] of new URLSearchParams(text)) {
    result[key] = value;
  }

  return result;
};

export const readJsonBody = <T>(event: RoutePayload): Partial<T> => {
  if (event.body && typeof event.body === 'object') {
    return event.body as Partial<T>;
  }
  const raw = event.rawBody ?? (typeof event.body === 'string' ? event.body : '');
  if (!raw) {
    return {};
  }
  try {
    const text = event.isBase64Encoded
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
    return JSON.parse(text) as Partial<T>;
  } catch {
    return {};
  }
};
