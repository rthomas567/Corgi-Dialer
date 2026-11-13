import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  LogicFunctionExecutionContext,
  RoutePayload,
} from 'twenty-sdk/logic-function';

import { QUEUE_ADD_FUNCTION_ID, ROUTE_QUEUE_ADD } from 'src/constants/universal-identifiers';
import { readJsonBody } from 'src/shared/route-body';
import { personName } from 'src/shared/targets';
import { createRecord, getRecord, listRecords } from 'src/shared/twenty-api';

export const MAX_QUEUE_ADD = 200;

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
  companyId?: string | null;
};
type Company = { id: string; name?: string | null };
type QueueItem = { id: string; personId?: string | null; companyId?: string | null };

const inChunks = async <T, R>(items: T[], size: number, run: (item: T) => Promise<R>) => {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(run))));
  }
  return results;
};

// "Add to Call Queue" on selected people or companies. Anyone already
// waiting in the queue isn't added twice.
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return { ok: false as const, message: 'Not signed in.' };
  }
  const { object, recordIds } = readJsonBody<{ object: string; recordIds: unknown }>(event);
  if (object !== 'person' && object !== 'company') {
    return { ok: false as const, message: 'Add people or companies to the Call Queue.' };
  }
  const ids = Array.isArray(recordIds)
    ? [...new Set(recordIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  if (ids.length === 0) {
    return { ok: false as const, message: 'Select at least one record.' };
  }
  if (ids.length > MAX_QUEUE_ADD) {
    return { ok: false as const, message: `Add ${MAX_QUEUE_ADD} records or fewer at a time.` };
  }

  const idField = object === 'person' ? 'personId' : 'companyId';
  const waiting = await listRecords<QueueItem>(
    'callQueueItems',
    `and(${idField}[in]:[${ids.map((id) => `"${id}"`).join(',')}],status[eq]:WAITING)`,
    MAX_QUEUE_ADD,
  );
  const alreadyWaiting = new Set(waiting.map((item) => item[idField]).filter(Boolean));
  const toAdd = ids.filter((id) => !alreadyWaiting.has(id));

  const created = await inChunks(toAdd, 10, async (id) => {
    try {
      if (object === 'person') {
        const person = await getRecord<Person>('people', id);
        if (!person) return false;
        await createRecord('callQueueItems', {
          name: personName(person),
          status: 'WAITING',
          personId: person.id,
          companyId: person.companyId ?? null,
        });
      } else {
        const company = await getRecord<Company>('companies', id);
        if (!company) return false;
        await createRecord('callQueueItems', {
          name: company.name?.trim() || 'Unknown company',
          status: 'WAITING',
          companyId: company.id,
        });
      }
      return true;
    } catch {
      return false;
    }
  });

  const added = created.filter(Boolean).length;
  return {
    ok: true as const,
    added,
    alreadyQueued: ids.length - toAdd.length,
    failed: toAdd.length - added,
  };
};

export default defineLogicFunction({
  universalIdentifier: QUEUE_ADD_FUNCTION_ID,
  name: 'dialer-queue-add',
  description: 'Adds selected people or companies to the Call Queue.',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: ROUTE_QUEUE_ADD,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
