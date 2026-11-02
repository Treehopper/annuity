import { ZERO, toMoney } from '../model/decimal';
import type { ScheduleRow, YearRow } from '../model/types';
import { rawRowsOf } from './schedule';

/** One row per calendar year; the fixed-rate end year is split into fixed / followUp parts (§6.6). */
export function aggregateYearly(schedule: readonly ScheduleRow[], _fixedRateMonths?: number): YearRow[] {
  const raw = rawRowsOf(schedule);
  type Acc = { year: number; phase: ScheduleRow['phase']; rows: number[] };
  const groups: Acc[] = [];
  schedule.forEach((r, idx) => {
    const year = Number(r.date.slice(0, 4));
    const g = groups[groups.length - 1];
    if (g && g.year === year && g.phase === r.phase) g.rows.push(idx);
    else groups.push({ year, phase: r.phase, rows: [idx] });
  });
  const splitYears = new Set<number>();
  for (let k = 1; k < groups.length; k++) {
    const a = groups[k - 1] as Acc;
    const b = groups[k] as Acc;
    if (a.year === b.year) splitYears.add(a.year);
  }
  return groups.map((g) => {
    let interest = ZERO;
    let principal = ZERO;
    let special = ZERO;
    for (const idx of g.rows) {
      const r = raw[idx]!;
      interest = interest.plus(r.interest);
      principal = principal.plus(r.regularPrincipal);
      special = special.plus(r.special);
    }
    const last = raw[g.rows[g.rows.length - 1]!]!;
    return {
      year: g.year,
      part: splitYears.has(g.year) ? g.phase : 'full',
      payments: g.rows.length,
      interest: toMoney(interest),
      regularPrincipal: toMoney(principal),
      special: toMoney(special),
      closing: toMoney(last.closing),
      isEstimate: g.phase === 'followUp',
    };
  });
}
