import type { Loan, Result, Settings } from '@alp/core';
import { create } from 'zustand';

import { getCore } from '@/composition';
import { deviceClock } from '@/platform/clock';

/**
 * View state over the core services (§4.2). Holds loaded loans and settings for
 * rendering, forwards every change to a core service and stores the result.
 */
export interface AppState {
  ready: boolean;
  loadError?: string;
  loans: Loan[];
  settings?: Settings;
  today: string;
  /** Last deleted loan, for the undo snackbar (§5.11). */
  lastDeleted?: Loan;

  init(): Promise<void>;
  refreshToday(): void;
  saveLoan(loan: Loan, opts?: { isNew?: boolean; rebaseline?: boolean }): Promise<Result<Loan>>;
  deleteLoan(id: string): Promise<void>;
  undoDelete(): Promise<void>;
  dismissUndo(): void;
  duplicateLoan(id: string): Promise<Result<Loan>>;
  lifecycle(id: string, action: 'activate' | 'rebaseline' | 'revertToOffer' | 'close' | 'reopen'): Promise<Result<Loan>>;
  confirmAsPlanned(loanId: string, date: string): Promise<Result<Loan>>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  newLoanTemplate(): Promise<Loan>;
}

function upsert(loans: Loan[], loan: Loan): Loan[] {
  const idx = loans.findIndex((l) => l.id === loan.id);
  if (idx < 0) return [...loans, loan];
  const next = loans.slice();
  next[idx] = loan;
  return next;
}

export const useAppStore = create<AppState>((set, get) => {
  const applyResult = (res: Result<Loan>): Result<Loan> => {
    if (res.ok) set({ loans: upsert(get().loans, res.value) });
    return res;
  };

  return {
    ready: false,
    loans: [],
    today: deviceClock.today(),

    async init() {
      try {
        const core = getCore();
        await core.init();
        const [loans, settings] = await Promise.all([core.loans.list(), core.settings.get()]);
        set({ loans, settings, ready: true, today: deviceClock.today() });
      } catch (e) {
        set({ ready: true, loadError: String(e) });
      }
    },

    refreshToday() {
      const today = deviceClock.today();
      if (today !== get().today) set({ today });
    },

    async saveLoan(loan, opts = {}) {
      const core = getCore();
      return applyResult(opts.isNew ? await core.loans.create(loan) : await core.loans.update(loan, { rebaseline: opts.rebaseline }));
    },

    async deleteLoan(id) {
      const deleted = await getCore().loans.delete(id);
      set({ loans: get().loans.filter((l) => l.id !== id), lastDeleted: deleted });
    },

    async undoDelete() {
      const loan = get().lastDeleted;
      if (!loan) return;
      await getCore().loans.restore(loan);
      set({ loans: upsert(get().loans, loan), lastDeleted: undefined });
    },

    dismissUndo() {
      set({ lastDeleted: undefined });
    },

    async duplicateLoan(id) {
      return applyResult(await getCore().loans.duplicate(id));
    },

    async lifecycle(id, action) {
      return applyResult(await getCore().loans[action](id));
    },

    async confirmAsPlanned(loanId, date) {
      return applyResult(await getCore().specials.setOverride(loanId, { date, kind: 'asPlanned', confirmed: true }));
    },

    async updateSettings(patch) {
      const settings = await getCore().settings.update(patch);
      set({ settings });
    },

    newLoanTemplate() {
      return getCore().loans.template();
    },
  };
});
