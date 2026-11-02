import type { Loan, LoanParams, SpecialRepaymentOverride, SpecialRepaymentRule } from '../src';

export function params(p: Partial<LoanParams> = {}): LoanParams {
  return {
    principal: '280000.00',
    nominalRate: '0.0308',
    payoutDate: '2024-06-15',
    firstPaymentDate: '2024-07-01',
    fixedRateMonths: 120,
    payment: { mode: 'term', termMonths: 216 },
    rounding: 'bank',
    ...p,
  };
}

export const monthly1100: SpecialRepaymentRule = {
  id: 'rule-1',
  frequency: 'monthly',
  amount: '1100.00',
  start: '2024-07-01',
};

export function loan(
  p: Partial<LoanParams> = {},
  extra: Partial<Omit<Loan, 'params'>> & { rules?: SpecialRepaymentRule[]; overrides?: SpecialRepaymentOverride[] } = {},
): Loan {
  const { rules, overrides, ...rest } = extra;
  const prm = params(p);
  return {
    id: 'loan-1',
    name: 'Test',
    status: 'offer',
    params: prm,
    specialRules: rules ?? [],
    specialOverrides: overrides ?? [],
    followUp: { rate: prm.nominalRate, payment: { mode: 'keepPayment' }, keepSpecialRules: true },
    notifications: { monthlyBreakdown: false, specialReminderDaysBefore: 3, fixedRateEndMonthsBefore: [12, 6] },
    createdAt: '2024-05-20T18:02:11Z',
    updatedAt: '2024-05-20T18:02:11Z',
    ...rest,
  };
}
