import {
  aggregateYearly,
  buildSchedule,
  compareLoans,
  computeKpis,
  type Loan,
  type LoanKpis,
  type OverviewFilter,
  type RankedLoan,
  type ScheduleRow,
  type SortDirection,
  type SortKey,
  type YearRow,
} from '@alp/core';
import { useMemo } from 'react';

import { useAppStore } from '@/store/appStore';

export type Projection = 'current' | 'withoutSpecial' | 'originalPlan';

interface Projected {
  schedule: ScheduleRow[];
  kpis: LoanKpis;
  yearly?: YearRow[];
}

/** Memoized projections per loan object (loans are immutable in the store). */
const cache = new WeakMap<Loan, Map<string, Projected>>();

export function project(loan: Loan, projection: Projection, today: string): Projected {
  let byKey = cache.get(loan);
  if (!byKey) cache.set(loan, (byKey = new Map()));
  const key = `${projection}|${today}`;
  let hit = byKey.get(key);
  if (!hit) {
    const schedule = buildSchedule(loan, {
      today,
      withoutSpecial: projection === 'withoutSpecial',
      useBaseline: projection === 'originalPlan',
    });
    hit = { schedule, kpis: computeKpis(loan, schedule, today) };
    byKey.set(key, hit);
  }
  return hit;
}

export function yearlyOf(loan: Loan, projection: Projection, today: string): YearRow[] {
  const p = project(loan, projection, today);
  p.yearly ??= aggregateYearly(p.schedule, loan.params.fixedRateMonths);
  return p.yearly;
}

export function useToday(): string {
  return useAppStore((s) => s.today);
}

export function useLoan(id: string | undefined): Loan | undefined {
  return useAppStore((s) => (id ? s.loans.find((l) => l.id === id) : undefined));
}

export function useProjection(loan: Loan | undefined, projection: Projection = 'current'): Projected | undefined {
  const today = useToday();
  return useMemo(() => (loan ? project(loan, projection, today) : undefined), [loan, projection, today]);
}

/** Loans for the overview: filtered and sorted per settings (B1). */
export function useOverview(): RankedLoan[] {
  const loans = useAppStore((s) => s.loans);
  const settings = useAppStore((s) => s.settings);
  const today = useToday();
  const filter: OverviewFilter = settings?.overviewFilter ?? 'all';
  const key: SortKey = settings?.overviewSort.key ?? 'payoffDate';
  const dir: SortDirection = settings?.overviewSort.direction ?? 'asc';
  return useMemo(() => {
    const visible = filter === 'all' ? loans : loans.filter((l) => l.status === filter);
    return compareLoans(visible, key, dir, today);
  }, [loans, filter, key, dir, today]);
}
