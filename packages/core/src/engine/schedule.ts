import { Decimal, dec, dmin, round2, toMoney, ZERO } from '../model/decimal';
import { addMonths } from '../model/dates';
import type {
  FollowUpAssumption,
  ISODate,
  Loan,
  LoanParams,
  ScheduleRow,
  SpecialRepaymentOverride,
  SpecialRepaymentRule,
  SpecialStatus,
} from '../model/types';
import { annuityDecimal } from './annuity';
import { overridesByDate, resolveSpecial } from './specials';

/** Hard cap: 50 years (§5.3). */
export const MAX_ROWS = 600;

export interface ScheduleOptions {
  /** "Without special repayments" projection (§4.7). */
  withoutSpecial?: boolean;
  /** "Original plan" projection: baseline params, rules and follow-up, no overrides (§4.7). */
  useBaseline?: boolean;
  /** The user's local calendar date; drives status, actuals and the "without" cut-off. */
  today?: ISODate;
}

/** Unrounded values of a row, kept for exact totals in spreadsheet mode. */
export interface RawRow {
  opening: Decimal;
  payment: Decimal;
  interest: Decimal;
  regularPrincipal: Decimal;
  special: Decimal;
  closing: Decimal;
}

export interface ScheduleInput {
  params: LoanParams;
  rules: readonly SpecialRepaymentRule[];
  overrides: readonly SpecialRepaymentOverride[];
  followUp: FollowUpAssumption;
}

const rawRows = new WeakMap<readonly ScheduleRow[], RawRow[]>();

/** Exact row values of a schedule produced by {@link buildSchedule}, or parsed from the strings. */
export function rawRowsOf(schedule: readonly ScheduleRow[]): RawRow[] {
  return (
    rawRows.get(schedule) ??
    schedule.map((r) => ({
      opening: dec(r.opening),
      payment: dec(r.payment),
      interest: dec(r.interest),
      regularPrincipal: dec(r.regularPrincipal),
      special: dec(r.special),
      closing: dec(r.closing),
    }))
  );
}

export function scheduleInputFor(loan: Loan, useBaseline = false): ScheduleInput {
  if (useBaseline && loan.baseline) {
    return {
      params: loan.baseline.params,
      rules: loan.baseline.specialRules,
      overrides: [],
      followUp: loan.baseline.followUp,
    };
  }
  return { params: loan.params, rules: loan.specialRules, overrides: loan.specialOverrides, followUp: loan.followUp };
}

/** Follow-up payment A' (§5.4). */
export function followUpPayment(A: Decimal, balanceAtFixedEnd: Decimal, followUp: FollowUpAssumption): Decimal {
  if (followUp.payment.mode === 'keepPayment') return A;
  const i2 = dec(followUp.rate);
  const t2 = dec(followUp.payment.rate);
  return round2(balanceAtFixedEnd.times(i2.plus(t2)).div(12));
}

/** Builds the amortization schedule (§5.3) for one of the three projections (§4.7). */
export function buildSchedule(loan: Loan, opts: ScheduleOptions = {}): ScheduleRow[] {
  const useBaseline = !!opts.useBaseline && !!loan.baseline;
  const input = scheduleInputFor(loan, useBaseline);
  const today = opts.today ?? '0000-00-00';
  const running = loan.status !== 'offer';

  // "Without": offers → all specials 0; active/closed → specials after today are 0 (§4.7).
  const keepSpecialOn = (d: ISODate): boolean => {
    if (!opts.withoutSpecial) return true;
    return running && opts.today !== undefined && d <= today;
  };

  const statusFor = (amount: Decimal, o: SpecialRepaymentOverride | undefined, d: ISODate): SpecialStatus => {
    if (amount.isZero() && !o) return 'none';
    if (o?.confirmed) return 'confirmed';
    if (!running || d > today) return 'planned';
    return 'unconfirmed';
  };

  const { rows, raw } = computeRows(input, keepSpecialOn, (d) => running && d <= today, statusFor);
  rawRows.set(rows, raw);
  return rows;
}

function computeRows(
  input: ScheduleInput,
  keepSpecialOn: (d: ISODate) => boolean,
  isActual: (d: ISODate) => boolean,
  statusFor: (amount: Decimal, o: SpecialRepaymentOverride | undefined, d: ISODate) => SpecialStatus,
): { rows: ScheduleRow[]; raw: RawRow[] } {
  const { params, rules, followUp } = input;
  const bankMode = params.rounding === 'bank';
  const R = bankMode ? round2 : (x: Decimal) => x;
  const overrides = overridesByDate(input.overrides);
  const Nfix = params.fixedRateMonths;
  const d1 = params.firstPaymentDate;
  const A = annuityDecimal(params);
  const i = dec(params.nominalRate);
  const i2 = dec(followUp.rate);
  const rows: ScheduleRow[] = [];
  const raw: RawRow[] = [];

  let B = dec(params.principal);
  let A2: Decimal | undefined;

  for (let n = 1; B.gt(0) && n <= MAX_ROWS; n++) {
    const fixed = n <= Nfix;
    if (!fixed && A2 === undefined) A2 = followUpPayment(A, B, followUp);
    const rate = fixed ? i : i2;
    const An = fixed ? A : (A2 as Decimal);
    const d = addMonths(d1, n - 1);

    const Z = R(B.times(rate).div(12));
    const due = An.minus(Z);
    // A sub-cent remainder counts as paid off: in spreadsheet mode the unrounded
    // annuity leaves a ~1e-37 residual after the last term month, which would
    // otherwise produce a phantom 0.00 → 0.00 row.
    const finalPayment = round2(B.minus(due)).lte(0);
    // Spreadsheet mode reproduces reference calculator 2, whose first row books
    // T₁ = P·t/12 instead of A − Z₁ (§2.2, §5.2, golden test G4).
    const T =
      n === 1 && !bankMode && params.payment.mode === 'initialRepayment'
        ? dmin(B.times(dec(params.payment.initialRepaymentRate)).div(12), B)
        : finalPayment
          ? B
          : due;

    const activeRules = fixed || followUp.keepSpecialRules ? rules : [];
    const resolved = resolveSpecial(activeRules, overrides, d);
    const keep = keepSpecialOn(d);
    const planned = keep ? resolved.amount : ZERO;
    const o = keep ? resolved.override : undefined;
    const S = finalPayment ? ZERO : dmin(planned, B.minus(T));
    const closing = B.minus(T).minus(S);

    raw.push({ opening: B, payment: T.plus(Z), interest: Z, regularPrincipal: T, special: S, closing });
    rows.push({
      n,
      date: d,
      opening: toMoney(B),
      payment: toMoney(T.plus(Z)),
      interest: toMoney(Z),
      regularPrincipal: toMoney(T),
      special: toMoney(S),
      closing: toMoney(closing),
      phase: fixed ? 'fixed' : 'followUp',
      isEstimate: !fixed,
      specialSource: o && o.kind !== 'asPlanned' ? 'override' : planned.gt(0) ? 'rule' : 'none',
      specialStatus: statusFor(planned, o, d),
      isActual: isActual(d),
    });
    B = closing;
  }
  return { rows, raw };
}
