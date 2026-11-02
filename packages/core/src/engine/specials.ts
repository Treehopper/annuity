import { Decimal, dec, ZERO } from '../model/decimal';
import { parseISODate } from '../model/dates';
import type { ISODate, SpecialRepaymentOverride, SpecialRepaymentRule } from '../model/types';

/** Planned amount: sum of all rules active on date d (§5.5). */
export function baseSpecial(rules: readonly SpecialRepaymentRule[], d: ISODate): Decimal {
  const month = parseISODate(d).m;
  let sum = ZERO;
  for (const r of rules) {
    if (r.start > d) continue;
    if (r.end !== undefined && r.end !== '' && d > r.end) continue;
    if (r.frequency === 'yearly' && r.month !== month) continue;
    sum = sum.plus(dec(r.amount));
  }
  return sum;
}

export interface ResolvedSpecial {
  amount: Decimal;
  base: Decimal;
  override?: SpecialRepaymentOverride;
}

/** Ŝ(d): the special repayment for date d after applying the override (§5.5). */
export function resolveSpecial(
  rules: readonly SpecialRepaymentRule[],
  overrides: ReadonlyMap<ISODate, SpecialRepaymentOverride>,
  d: ISODate,
): ResolvedSpecial {
  const base = baseSpecial(rules, d);
  const o = overrides.get(d);
  if (!o) return { amount: base, base };
  switch (o.kind) {
    case 'asPlanned':
      return { amount: base, base, override: o };
    case 'skipped':
      return { amount: ZERO, base, override: o };
    case 'changed':
      return { amount: dec(o.amount ?? '0'), base, override: o };
    case 'additional':
      return { amount: base.plus(dec(o.amount ?? '0')), base, override: o };
  }
}

export function overridesByDate(
  overrides: readonly SpecialRepaymentOverride[],
): Map<ISODate, SpecialRepaymentOverride> {
  const m = new Map<ISODate, SpecialRepaymentOverride>();
  for (const o of overrides) if (!m.has(o.date)) m.set(o.date, o);
  return m;
}
