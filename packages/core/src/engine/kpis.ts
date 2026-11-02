import { dec, toMoney, toRate, ZERO } from '../model/decimal';
import { addMonths, yearMonth } from '../model/dates';
import type { ISODate, Loan, LoanKpis, ScheduleRow } from '../model/types';
import { annuityDecimal, equivalentInitialRepayment } from './annuity';
import { rawRowsOf } from './schedule';

/** Date of payment n = N_fix (§5.10). */
export function fixedRateEndDate(loan: Loan): ISODate {
  return addMonths(loan.params.firstPaymentDate, loan.params.fixedRateMonths - 1);
}

/** "This month" row (§5.10): active loans only. */
export function thisMonthOf(
  loan: Loan,
  schedule: readonly ScheduleRow[],
  today: ISODate,
): LoanKpis['thisMonth'] {
  if (loan.status !== 'active' || schedule.length === 0) return undefined;
  const ym = yearMonth(today);
  const current = schedule.find((r) => yearMonth(r.date) === ym);
  if (current) return { row: current, kind: 'current' };
  const first = schedule[0] as ScheduleRow;
  if (yearMonth(first.date) > ym) return { row: first, kind: 'first' };
  return undefined;
}

/** Monthly outlay = A + monthly rules + yearly rules / 12, active on the reference date (§5.10). */
export function monthlyOutlay(loan: Loan, referenceDate: ISODate) {
  let sum = annuityDecimal(loan.params);
  for (const r of loan.specialRules) {
    if (r.start > referenceDate) continue;
    if (r.end && referenceDate > r.end) continue;
    sum = r.frequency === 'monthly' ? sum.plus(dec(r.amount)) : sum.plus(dec(r.amount).div(12));
  }
  return toMoney(sum);
}

export function computeKpis(loan: Loan, schedule: readonly ScheduleRow[], today: ISODate): LoanKpis {
  const raw = rawRowsOf(schedule);
  const Nfix = loan.params.fixedRateMonths;
  const thisMonth = thisMonthOf(loan, schedule, today);
  const refDate = loan.status === 'active' && thisMonth ? thisMonth.row.date : loan.params.firstPaymentDate;

  let interest = ZERO;
  let principal = ZERO;
  let special = ZERO;
  let fixInterest = ZERO;
  let fixPrincipal = ZERO;
  let fixSpecial = ZERO;
  raw.forEach((r, idx) => {
    interest = interest.plus(r.interest);
    principal = principal.plus(r.regularPrincipal);
    special = special.plus(r.special);
    if (idx < Nfix) {
      fixInterest = fixInterest.plus(r.interest);
      fixPrincipal = fixPrincipal.plus(r.regularPrincipal);
      fixSpecial = fixSpecial.plus(r.special);
    }
  });

  const last = schedule[schedule.length - 1];
  const paidOffBeforeEnd = schedule.length <= Nfix;
  const fixedRow = raw[Nfix - 1];

  return {
    annuity: toMoney(annuityDecimal(loan.params)),
    initialRepaymentRate: toRate(equivalentInitialRepayment(loan.params)),
    monthlyOutlay: monthlyOutlay(loan, refDate),
    atFixedRateEnd: {
      date: fixedRateEndDate(loan),
      balance: paidOffBeforeEnd || !fixedRow ? '0.00' : toMoney(fixedRow.closing),
      interestPaid: toMoney(fixInterest),
      regularPrincipalPaid: toMoney(fixPrincipal),
      specialPaid: toMoney(fixSpecial),
      payments: Math.min(schedule.length, Nfix),
      paidOffBeforeEnd,
    },
    payoff: {
      date: last ? last.date : loan.params.firstPaymentDate,
      payments: schedule.length,
      totalInterest: toMoney(interest),
      totalSpecial: toMoney(special),
      isEstimate: last ? last.isEstimate : false,
    },
    thisMonth,
    unconfirmedSpecials: schedule.filter((r) => r.specialStatus === 'unconfirmed').length,
  };
}
