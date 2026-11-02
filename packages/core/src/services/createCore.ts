import { buildSchedule } from '../engine/schedule';
import { CURRENT_SCHEMA_VERSION, defaultNotificationPrefs, defaultSettings, newLoanTemplate, structuredCloneJson } from '../model/defaults';
import type { Loan, Settings, SpecialRepaymentOverride, ValidationIssue } from '../model/types';
import { migrateDocuments } from '../migrations';
import type { CorePorts, DataStore } from '../ports';
import { hasErrors, validateLoan } from '../validation/validateLoan';

export type Result<T> = { ok: true; value: T; warnings: ValidationIssue[] } | { ok: false; issues: ValidationIssue[] };

function ok<T>(value: T, warnings: ValidationIssue[] = []): Result<T> {
  return { ok: true, value, warnings };
}
function fail<T>(messageKey: string, path = ''): Result<T> {
  return { ok: false, issues: [{ path, messageKey, severity: 'error' }] };
}

/** Creates the use-case services over the given ports (README §4.7). */
export function createCore(ports: CorePorts) {
  const { store, clock, ids } = ports;

  async function load(id: string, s: DataStore = store): Promise<Loan | undefined> {
    return s.loans.get(id);
  }

  /** Validates, stamps updatedAt and writes. */
  async function persist(loan: Loan, s: DataStore = store): Promise<Result<Loan>> {
    const issues = validateLoan(loan);
    if (hasErrors(issues)) return { ok: false, issues };
    const saved: Loan = { ...loan, updatedAt: clock.now() };
    await s.loans.save(saved);
    return ok(saved, issues);
  }

  async function mutate(id: string, fn: (loan: Loan) => Loan | Result<Loan>): Promise<Result<Loan>> {
    return store.transaction(async (tx) => {
      const loan = await load(id, tx);
      if (!loan) return fail<Loan>('err.loan.notFound');
      const next = fn(structuredCloneJson(loan));
      if ('ok' in next) {
        if (!next.ok) return next;
        return persist(next.value, tx);
      }
      return persist(next, tx);
    });
  }

  const snapshot = (loan: Loan) => ({
    params: structuredCloneJson(loan.params),
    specialRules: structuredCloneJson(loan.specialRules),
    followUp: structuredCloneJson(loan.followUp),
    createdAt: clock.now(),
  });

  const settings = {
    async get(): Promise<Settings> {
      return (await store.settings.get()) ?? defaultSettings();
    },
    async update(patch: Partial<Settings>): Promise<Settings> {
      const next = { ...(await settings.get()), ...patch, schemaVersion: CURRENT_SCHEMA_VERSION };
      await store.settings.save(next);
      return next;
    },
  };

  const loans = {
    list: () => store.loans.list(),
    get: (id: string) => load(id),

    /** Unsaved template for the "New loan" form (§5.11). */
    async template(): Promise<Loan> {
      return newLoanTemplate({ id: ids.uuid(), today: clock.today(), now: clock.now(), settings: await settings.get() });
    },

    async create(draft: Loan): Promise<Result<Loan>> {
      const now = clock.now();
      const loan: Loan = { ...structuredCloneJson(draft), status: 'offer', baseline: undefined, createdAt: now };
      if (!loan.id || (await store.loans.get(loan.id))) loan.id = ids.uuid();
      return persist(loan);
    },

    /** Saves edits. Contract data of active loans is only changed through rebaseline (§5.11). */
    async update(loan: Loan, opts: { rebaseline?: boolean } = {}): Promise<Result<Loan>> {
      return mutate(loan.id, (old) => {
        if (old.status === 'closed') {
          return { ...old, name: loan.name, lender: loan.lender, notes: loan.notes };
        }
        const next: Loan = { ...structuredCloneJson(loan), status: old.status, baseline: old.baseline, createdAt: old.createdAt };
        if (old.status === 'active' && JSON.stringify(old.params) !== JSON.stringify(loan.params)) {
          if (!opts.rebaseline) return fail<Loan>('err.contract.locked', 'params');
          next.baseline = snapshot(next);
        }
        return next;
      });
    },

    async delete(id: string): Promise<Loan | undefined> {
      const loan = await load(id);
      if (loan) await store.loans.delete(id);
      return loan;
    },

    /** Undo of delete (§5.11): writes the loan back unchanged. */
    async restore(loan: Loan): Promise<void> {
      await store.loans.save(loan);
    },

    async duplicate(id: string, suffix = ' (copy)'): Promise<Result<Loan>> {
      const src = await load(id);
      if (!src) return fail('err.loan.notFound');
      const s = await settings.get();
      const now = clock.now();
      const copy: Loan = {
        id: ids.uuid(),
        name: (src.name + suffix).slice(0, 80),
        lender: src.lender,
        notes: src.notes,
        status: 'offer',
        params: structuredCloneJson(src.params),
        specialRules: src.specialRules.map((r) => ({ ...r, id: ids.uuid() })),
        specialOverrides: src.specialOverrides.map((o) => ({ ...o, id: ids.uuid(), confirmed: false })),
        followUp: structuredCloneJson(src.followUp),
        notifications: structuredCloneJson(s.notifications.newLoanDefaults ?? defaultNotificationPrefs()),
        createdAt: now,
        updatedAt: now,
      };
      return persist(copy);
    },

    activate: (id: string) =>
      mutate(id, (l) => (l.status !== 'offer' ? fail('err.lifecycle.invalid') : { ...l, status: 'active', baseline: snapshot(l) })),
    rebaseline: (id: string) =>
      mutate(id, (l) => (l.status !== 'active' ? fail('err.lifecycle.invalid') : { ...l, baseline: snapshot(l) })),
    revertToOffer: (id: string) =>
      mutate(id, (l) => (l.status !== 'active' ? fail('err.lifecycle.invalid') : { ...l, status: 'offer', baseline: undefined })),
    close: (id: string) => mutate(id, (l) => (l.status !== 'active' ? fail('err.lifecycle.invalid') : { ...l, status: 'closed' })),
    reopen: (id: string) => mutate(id, (l) => (l.status !== 'closed' ? fail('err.lifecycle.invalid') : { ...l, status: 'active' })),
  };

  const specials = {
    /** Adds or replaces the override for its date (at most one per date, §5.6). */
    setOverride: (loanId: string, override: Omit<SpecialRepaymentOverride, 'id'> & { id?: string }) =>
      mutate(loanId, (l) => {
        if (l.status === 'closed') return fail('err.lifecycle.invalid');
        const o: SpecialRepaymentOverride = { ...override, id: override.id ?? ids.uuid() };
        if (o.kind === 'asPlanned') o.confirmed = true;
        return { ...l, specialOverrides: [...l.specialOverrides.filter((x) => x.id !== o.id && x.date !== o.date), o] };
      }),

    removeOverride: (loanId: string, overrideId: string) =>
      mutate(loanId, (l) => ({ ...l, specialOverrides: l.specialOverrides.filter((o) => o.id !== overrideId) })),

    /** Confirms all past unconfirmed special repayments as booked (§6.7). */
    confirmPastAsPlanned: (loanId: string) =>
      mutate(loanId, (l) => {
        const schedule = buildSchedule(l, { today: clock.today() });
        const byDate = new Map(l.specialOverrides.map((o) => [o.date, o]));
        const overrides = [...l.specialOverrides];
        for (const row of schedule) {
          if (row.specialStatus !== 'unconfirmed') continue;
          const existing = byDate.get(row.date);
          if (existing) overrides[overrides.indexOf(existing)] = { ...existing, confirmed: true };
          else overrides.push({ id: ids.uuid(), date: row.date, kind: 'asPlanned', confirmed: true });
        }
        return { ...l, specialOverrides: overrides };
      }),
  };

  /** Runs pending document migrations on stored data (§4.5). Call once on start. */
  async function init(): Promise<void> {
    const version = Number((await store.meta.get('schemaVersion')) ?? CURRENT_SCHEMA_VERSION);
    if (version < CURRENT_SCHEMA_VERSION) {
      await store.transaction(async (tx) => {
        const docs = migrateDocuments({ loans: await tx.loans.list(), settings: await tx.settings.get() }, version);
        for (const l of docs.loans as Loan[]) await tx.loans.save(l);
        if (docs.settings) await tx.settings.save(docs.settings as Settings);
      });
    }
    await store.meta.set('schemaVersion', String(CURRENT_SCHEMA_VERSION));
  }

  return { init, loans, specials, settings, ports };
}

export type Core = ReturnType<typeof createCore>;
