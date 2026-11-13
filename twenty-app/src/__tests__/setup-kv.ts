import { beforeEach, vi } from 'vitest';

// An in-memory stand-in for Twenty's app storage (kv) in unit tests.
const store = new Map<string, unknown>();
(globalThis as { __kvStore?: Map<string, unknown> }).__kvStore = store;

vi.mock('twenty-sdk/logic-function', async (importOriginal) => {
  const actual = await importOriginal<typeof import('twenty-sdk/logic-function')>();
  return {
    ...actual,
    kv: {
      get: async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null),
      set: async (key: string, value: unknown) => {
        store.set(key, structuredClone(value));
      },
      delete: async (key: string) => store.delete(key),
    },
  };
});

beforeEach(() => {
  store.clear();
});
