/** In-memory port adapters: headless tests and reference implementation for a future backend (§4.2). */
import type { CorePorts, DataStore, FileGateway, Loan, NotificationScheduler, PlannedNotification, Settings } from '../src';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function inMemoryStore(): DataStore & { dump(): { loans: Loan[]; settings?: Settings; meta: Record<string, string> } } {
  const loans = new Map<string, Loan>();
  let settings: Settings | undefined;
  const meta = new Map<string, string>();
  const store: DataStore & { dump(): { loans: Loan[]; settings?: Settings; meta: Record<string, string> } } = {
    loans: {
      list: async () => [...loans.values()].map(clone),
      get: async (id) => (loans.has(id) ? clone(loans.get(id)) : undefined),
      save: async (l) => void loans.set(l.id, clone(l)),
      delete: async (id) => void loans.delete(id),
      listChanges: async (since) => [...loans.values()].filter((l) => l.updatedAt > since).map(clone),
    },
    settings: {
      get: async () => (settings ? clone(settings) : undefined),
      save: async (s) => void (settings = clone(s)),
    },
    meta: {
      get: async (k) => meta.get(k),
      set: async (k, v) => void meta.set(k, v),
    },
    // Single-threaded and in-memory: run directly; a failure rolls back via a snapshot.
    transaction: async (fn) => {
      const snap = { loans: new Map(loans), settings, meta: new Map(meta) };
      try {
        return await fn(store);
      } catch (e) {
        loans.clear();
        snap.loans.forEach((v, k) => loans.set(k, v));
        settings = snap.settings;
        meta.clear();
        snap.meta.forEach((v, k) => meta.set(k, v));
        throw e;
      }
    },
    dump: () => ({ loans: [...loans.values()].map(clone), settings: settings && clone(settings), meta: Object.fromEntries(meta) }),
  };
  return store;
}

export function fixedClock(today = '2026-10-15', time = '09:50:00') {
  let t = 0;
  return {
    today: () => today,
    // Strictly increasing timestamps on the same day, so ordering is testable.
    now: () => `${today}T${time.slice(0, 6)}${String(t++ % 60).padStart(2, '0')}Z`,
  };
}

export function sequenceIds(prefix = 'id') {
  let n = 0;
  return { uuid: () => `${prefix}-${String(++n).padStart(4, '0')}` };
}

export function recordingScheduler(): NotificationScheduler & { plans: PlannedNotification[][] } {
  const plans: PlannedNotification[][] = [];
  return { plans, replaceAll: async (p) => void plans.push(p) };
}

export function inMemoryFiles(): FileGateway & { shared: { name: string; content: string }[]; next?: { name: string; content: string } } {
  const g: FileGateway & { shared: { name: string; content: string }[]; next?: { name: string; content: string } } = {
    shared: [],
    share: async (f) => void g.shared.push({ name: f.name, content: f.content }),
    pick: async () => g.next,
  };
  return g;
}

export function inMemoryPorts(today?: string): CorePorts {
  return {
    store: inMemoryStore(),
    clock: fixedClock(today),
    ids: sequenceIds(),
    notifications: recordingScheduler(),
    files: inMemoryFiles(),
  };
}
