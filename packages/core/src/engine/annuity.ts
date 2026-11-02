import { Decimal, dec, round2, toMoney } from '../model/decimal';
import type { LoanParams, Money } from '../model/types';

/** Monthly payment A as an exact Decimal (§5.2), including the per-mode rounding rule. */
export function annuityDecimal(params: LoanParams): Decimal {
  const P = dec(params.principal);
  const i = dec(params.nominalRate);
  const bank = params.rounding === 'bank';
  switch (params.payment.mode) {
    case 'initialRepayment': {
      const t = dec(params.payment.initialRepaymentRate);
      return round2(P.times(i.plus(t)).div(12));
    }
    case 'term': {
      const N = params.payment.termMonths;
      const r = i.div(12);
      const raw = r.isZero() ? P.div(N) : P.times(r).div(new Decimal(1).minus(r.plus(1).pow(-N)));
      return bank ? round2(raw) : raw;
    }
    case 'fixedAmount':
      return dec(params.payment.amount);
  }
}

/** Monthly payment as canonical money (display value, rounded to the cent). */
export function computeAnnuity(params: LoanParams): Money {
  return toMoney(annuityDecimal(params));
}

/** Equivalent initial repayment rate t = 12·A/P − i (§5.2), as a Decimal fraction. */
export function equivalentInitialRepayment(params: LoanParams): Decimal {
  const P = dec(params.principal);
  if (P.isZero()) return new Decimal(0);
  return annuityDecimal(params).times(12).div(P).minus(dec(params.nominalRate));
}
