import type { ISODate, Loan, LoanKpis, RankedLoan, SortDirection, SortKey } from '../model/types';
import { computeKpis } from './kpis';
import { buildSchedule } from './schedule';

/** Comparable value of a loan for a sort key (lower is better for every key, §3.2 B1). */
export function sortValue(loan: Loan, kpis: LoanKpis, key: SortKey): number | string {
  switch (key) {
    case 'rate':
      return Number(loan.params.nominalRate);
    case 'payoffDate':
      return kpis.payoff.date;
    case 'totalInterest':
      return Number(kpis.payoff.totalInterest);
    case 'balanceAtFixedEnd':
      return Number(kpis.atFixedRateEnd.balance);
    case 'payment':
      return Number(kpis.annuity);
    case 'monthlyOutlay':
      return Number(kpis.monthlyOutlay);
  }
}

function cmp(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/** Sorts loans by key and direction; ties are ordered by name. Equal values share a rank. */
export function compareLoans(
  loans: readonly Loan[],
  sortKey: SortKey,
  dir: SortDirection,
  today: ISODate,
): RankedLoan[] {
  const items = loans.map((loan) => ({ loan, kpis: computeKpis(loan, buildSchedule(loan, { today }), today) }));
  const sign = dir === 'asc' ? 1 : -1;
  items.sort(
    (a, b) =>
      sign * cmp(sortValue(a.loan, a.kpis, sortKey), sortValue(b.loan, b.kpis, sortKey)) ||
      a.loan.name.localeCompare(b.loan.name),
  );
  const ranked: RankedLoan[] = [];
  items.forEach((it, idx) => {
    const prev = ranked[idx - 1];
    const same = prev && cmp(sortValue(prev.loan, prev.kpis, sortKey), sortValue(it.loan, it.kpis, sortKey)) === 0;
    ranked.push({ ...it, rank: same && prev ? prev.rank : idx + 1 });
  });
  return ranked;
}

