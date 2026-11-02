import type { DataStore, Loan, Settings } from '@alp/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB adapter (§4.1, §4.6). The origin is shared with other pages on
 * hohenegger.eu, so only the database "annuity-loan-planner" is used.
 */
interface AlpDB extends DBSchema {
  loans: { key: string; value: Loan };
  settings: { key: number; value: Settings };
  meta: { key: string; value: string };
}

const DB_NAME = 'annuity-loan-planner';

let dbPromise: Promise<IDBPDatabase<AlpDB>> | undefined;
function db() {
  dbPromise ??= openDB<AlpDB>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('loans', { keyPath: 'id' });
      d.createObjectStore('settings');
      d.createObjectStore('meta');
    },
  });
  return dbPromise;
}

let persistRequested = false;
async function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or denied: data stays best-effort.
  }
}

type Write =
  | { store: 'loans'; op: 'put'; value: Loan }
  | { store: 'loans'; op: 'delete'; key: string }
  | { store: 'settings'; op: 'put'; value: Settings }
  | { store: 'meta'; op: 'put'; key: string; value: string };

async function commit(writes: Write[]) {
  if (writes.length === 0) return;
  void requestPersistence();
  const tx = (await db()).transaction(['loans', 'settings', 'meta'], 'readwrite');
  for (const w of writes) {
    if (w.store === 'loans') {
      if (w.op === 'put') void tx.objectStore('loans').put(w.value);
      else void tx.objectStore('loans').delete(w.key);
    } else if (w.store === 'settings') void tx.objectStore('settings').put(w.value, 1);
    else void tx.objectStore('meta').put(w.value, w.key);
  }
  await tx.done;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * IndexedDB transactions auto-commit when the event loop is idle, so they cannot span
 * the core's async callbacks. A transaction therefore reads through, buffers its
 * writes (read-your-writes) and commits them in one IDB transaction at the end.
 */
function createStore(buffer?: { writes: Write[]; loans: Map<string, Loan | null>; settings?: Settings; meta: Map<string, string> }): DataStore {
  const write = async (w: Write) => {
    if (!buffer) return commit([w]);
    buffer.writes.push(w);
    if (w.store === 'loans') buffer.loans.set(w.op === 'put' ? w.value.id : w.key, w.op === 'put' ? clone(w.value) : null);
    else if (w.store === 'settings') buffer.settings = clone(w.value);
    else buffer.meta.set(w.key, w.value);
  };
  const store: DataStore = {
    loans: {
      async list() {
        const all = await (await db()).getAll('loans');
        if (!buffer) return all;
        const map = new Map(all.map((l) => [l.id, l]));
        buffer.loans.forEach((v, k) => (v ? map.set(k, clone(v)) : map.delete(k)));
        return [...map.values()];
      },
      async get(id) {
        if (buffer?.loans.has(id)) {
          const v = buffer.loans.get(id);
          return v ? clone(v) : undefined;
        }
        return (await db()).get('loans', id);
      },
      save: (loan) => write({ store: 'loans', op: 'put', value: clone(loan) }),
      delete: (id) => write({ store: 'loans', op: 'delete', key: id }),
      async listChanges(since) {
        return (await store.loans.list()).filter((l) => l.updatedAt > since);
      },
    },
    settings: {
      async get() {
        if (buffer?.settings) return clone(buffer.settings);
        return (await db()).get('settings', 1);
      },
      save: (s) => write({ store: 'settings', op: 'put', value: clone(s) }),
    },
    meta: {
      async get(key) {
        if (buffer?.meta.has(key)) return buffer.meta.get(key);
        return (await db()).get('meta', key);
      },
      set: (key, value) => write({ store: 'meta', op: 'put', key, value }),
    },
    async transaction(fn) {
      if (buffer) return fn(store); // nested: join the outer transaction
      const inner = { writes: [] as Write[], loans: new Map<string, Loan | null>(), meta: new Map<string, string>() };
      const result = await fn(createStore(inner));
      await commit(inner.writes);
      return result;
    },
  };
  return store;
}

export function createDataStore(): DataStore {
  return createStore();
}
