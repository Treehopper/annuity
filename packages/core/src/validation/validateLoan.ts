import { dec, isMoney, isRate, round2 } from '../model/decimal';
import { addMonths, isISODate } from '../model/dates';
import type { Loan, LoanNotificationPrefs, ValidationIssue } from '../model/types';
import { annuityDecimal } from '../engine/annuity';
import { buildSchedule, followUpPayment, MAX_ROWS } from '../engine/schedule';

/** Validation rules (README §5.6). Returns message keys; the frontend translates them. */
export function validateLoan(loan: Loan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, messageKey: string, params?: ValidationIssue['params']) =>
    issues.push({ path, messageKey, params, severity: 'error' });
  const warn = (path: string, messageKey: string, params?: ValidationIssue['params']) =>
    issues.push({ path, messageKey, params, severity: 'warning' });

  const name = loan.name.trim();
  if (name.length === 0) err('name', 'err.name.required');
  else if (name.length > 80) err('name', 'err.name.length', { max: 80 });
  if (loan.notes && loan.notes.length > 2000) err('notes', 'err.note.length', { max: 2000 });

  const p = loan.params;
  let numericOk = true;

  if (!isMoney(p.principal) || dec(p.principal).lt(1000) || dec(p.principal).gt(10_000_000)) {
    err('params.principal', 'err.principal.range', { min: 1000, max: 10_000_000 });
    numericOk = false;
  }
  if (!isRate(p.nominalRate) || dec(p.nominalRate).lt(0) || dec(p.nominalRate).gt(0.2) || decimalsInPercent(p.nominalRate) > 3) {
    err('params.nominalRate', 'err.rate.range', { min: 0, max: 20 });
    numericOk = false;
  }
  if (!Number.isInteger(p.fixedRateMonths) || p.fixedRateMonths < 12 || p.fixedRateMonths > 480) {
    err('params.fixedRateMonths', 'err.fixed.range', { min: 12, max: 480 });
    numericOk = false;
  }
  const payoutOk = isISODate(p.payoutDate);
  if (!payoutOk) err('params.payoutDate', 'err.payout.required');
  if (!isISODate(p.firstPaymentDate) || (payoutOk && (p.firstPaymentDate < p.payoutDate || p.firstPaymentDate > addMonths(p.payoutDate, 12)))) {
    err('params.firstPaymentDate', 'err.firstPayment.range');
    numericOk = false;
  }

  switch (p.payment.mode) {
    case 'initialRepayment': {
      const t = p.payment.initialRepaymentRate;
      if (!isRate(t) || dec(t).lt(0.005) || dec(t).gt(0.3)) {
        err('params.payment.initialRepaymentRate', 'err.repayment.range', { min: 0.5, max: 30 });
        numericOk = false;
      }
      break;
    }
    case 'term': {
      const N = p.payment.termMonths;
      if (!Number.isInteger(N) || N < 12 || N > 600) {
        err('params.payment.termMonths', 'err.term.range', { min: 12, max: 600 });
        numericOk = false;
      }
      break;
    }
    case 'fixedAmount': {
      const a = p.payment.amount;
      if (!isMoney(a)) {
        err('params.payment.amount', 'err.payment.belowInterest');
        numericOk = false;
      } else if (numericOk) {
        const firstInterest = round2(dec(p.principal).times(dec(p.nominalRate)).div(12));
        if (dec(a).lte(firstInterest)) {
          err('params.payment.amount', 'err.payment.belowInterest', { interest: firstInterest.toFixed(2) });
          numericOk = false;
        }
      }
      break;
    }
  }

  const h = p.financingHelper;
  if (h) {
    const vals = [h.purchasePrice, h.incidentalCosts, h.equity];
    if (vals.some((v) => !isMoney(v) || dec(v).lt(0))) err('params.financingHelper', 'err.helper.negative');
    else if (dec(h.purchasePrice).plus(dec(h.incidentalCosts)).minus(dec(h.equity)).lte(0))
      err('params.financingHelper', 'err.helper.equityTooHigh');
  }

  loan.specialRules.forEach((r, idx) => {
    const base = `specialRules.${idx}`;
    if (!isMoney(r.amount) || dec(r.amount).lte(0)) err(`${base}.amount`, 'err.special.amount');
    if (r.frequency === 'yearly' && (!Number.isInteger(r.month) || (r.month as number) < 1 || (r.month as number) > 12))
      err(`${base}.month`, 'err.special.month');
    if (!isISODate(r.start)) err(`${base}.start`, 'err.special.endBeforeStart');
    else if (r.end && (!isISODate(r.end) || r.end < r.start)) err(`${base}.end`, 'err.special.endBeforeStart');
  });

  const seen = new Set<string>();
  loan.specialOverrides.forEach((o, idx) => {
    const base = `specialOverrides.${idx}`;
    const needsAmount = o.kind === 'changed' || o.kind === 'additional';
    if (needsAmount ? !isMoney(o.amount) || dec(o.amount).lte(0) : o.amount !== undefined)
      err(`${base}.amount`, 'err.override.amount');
    if (seen.has(o.date)) err(`${base}.date`, 'err.override.duplicate');
    seen.add(o.date);
    if (o.note && o.note.length > 2000) err(`${base}.note`, 'err.note.length', { max: 2000 });
  });

  const f = loan.followUp;
  if (!isRate(f.rate) || dec(f.rate).lt(0) || dec(f.rate).gt(0.2)) {
    err('followUp.rate', 'err.followUp.rate', { min: 0, max: 20 });
    numericOk = false;
  }
  if (f.payment.mode === 'repaymentRate') {
    const t2 = f.payment.rate;
    if (!isRate(t2) || dec(t2).lt(0.005) || dec(t2).gt(0.3)) {
      err('followUp.payment.rate', 'err.followUp.repayment', { min: 0.5, max: 30 });
      numericOk = false;
    }
  }

  issues.push(...validateNotificationPrefs(loan.notifications, 'notifications'));

  // Checks that need a schedule run only on otherwise valid numbers.
  if (numericOk && issues.every((i) => i.severity !== 'error')) {
    const schedule = buildSchedule(loan);
    const Nfix = p.fixedRateMonths;
    if (schedule.length > Nfix) {
      const B = dec(schedule[Nfix - 1]!.closing);
      const A2 = followUpPayment(annuityDecimal(p), B, f);
      const interest = round2(B.times(dec(f.rate)).div(12));
      if (A2.lte(interest)) err('followUp.payment', 'err.followUp.belowInterest');
    }
    const last = schedule[schedule.length - 1];
    if (schedule.length >= MAX_ROWS && last && dec(last.closing).gt(0)) warn('schedule', 'warn.schedule.tooLong');
    const dates = new Set(schedule.map((r) => r.date));
    loan.specialOverrides.forEach((o, idx) => {
      if (!dates.has(o.date)) warn(`specialOverrides.${idx}.date`, 'warn.override.orphaned', { date: o.date });
    });
  }

  return issues;
}

export function validateNotificationPrefs(n: LoanNotificationPrefs, base: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const d = n.specialReminderDaysBefore;
  if (d !== undefined && (!Number.isInteger(d) || d < 1 || d > 30))
    issues.push({ path: `${base}.specialReminderDaysBefore`, messageKey: 'err.notify.days', severity: 'error' });
  const m = n.fixedRateEndMonthsBefore;
  if (m.length > 3 || m.some((x) => !Number.isInteger(x) || x < 1 || x > 36) || new Set(m).size !== m.length)
    issues.push({ path: `${base}.fixedRateEndMonthsBefore`, messageKey: 'err.notify.months', severity: 'error' });
  return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

function decimalsInPercent(rate: string): number {
  const s = dec(rate).times(100).toString();
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}
