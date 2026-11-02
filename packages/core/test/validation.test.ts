import { validateLoan } from '../src';
import { loan, monthly1100 } from './fixtures';

const keys = (l: Parameters<typeof validateLoan>[0]) => validateLoan(l).map((i) => i.messageKey);

describe('validation (§5.6)', () => {
  it('accepts the reference loan', () => {
    expect(keys(loan({}, { rules: [monthly1100] }))).toEqual([]);
  });
  it('ranges', () => {
    expect(keys(loan({ nominalRate: '0.21' }))).toContain('err.rate.range');
    expect(keys(loan({ nominalRate: '0.030851' }))).toContain('err.rate.range'); // 4 decimals in percent
    expect(keys(loan({ fixedRateMonths: 6 }))).toContain('err.fixed.range');
    expect(keys(loan({ payment: { mode: 'term', termMonths: 601 } }))).toContain('err.term.range');
    expect(keys(loan({ payment: { mode: 'initialRepayment', initialRepaymentRate: '0.001' } }))).toContain('err.repayment.range');
    expect(keys(loan({ firstPaymentDate: '2024-06-01' }))).toContain('err.firstPayment.range');
    expect(keys(loan({ firstPaymentDate: '2025-07-01' }))).toContain('err.firstPayment.range');
  });
  it('fixed amount must exceed first-month interest', () => {
    expect(keys(loan({ payment: { mode: 'fixedAmount', amount: '718.67' } }))).toContain('err.payment.belowInterest');
    expect(keys(loan({ payment: { mode: 'fixedAmount', amount: '1500.00' } }))).toEqual([]);
  });
  it('helper', () => {
    expect(
      keys(loan({ financingHelper: { purchasePrice: '100000.00', incidentalCosts: '0.00', equity: '100000.00' } })),
    ).toContain('err.helper.equityTooHigh');
  });
  it('overrides', () => {
    const l = loan({}, {
      overrides: [
        { id: 'a', date: '2025-01-01', kind: 'changed', confirmed: false },
        { id: 'b', date: '2025-01-01', kind: 'skipped', confirmed: false },
        { id: 'c', date: '2099-01-01', kind: 'skipped', confirmed: false },
      ],
    });
    expect(keys(l)).toEqual(expect.arrayContaining(['err.override.amount', 'err.override.duplicate']));
  });
  it('orphaned overrides are warnings', () => {
    const issues = validateLoan(loan({}, { overrides: [{ id: 'c', date: '2099-01-01', kind: 'skipped', confirmed: false }] }));
    expect(issues).toEqual([expect.objectContaining({ messageKey: 'warn.override.orphaned', severity: 'warning' })]);
  });
  it('follow-up payment must cover interest', () => {
    const l = loan({ fixedRateMonths: 60 });
    l.followUp = { rate: '0.2', payment: { mode: 'keepPayment' }, keepSpecialRules: true };
    expect(keys(l)).toContain('err.followUp.belowInterest');
  });
  it('notification prefs', () => {
    const l = loan();
    l.notifications = { monthlyBreakdown: true, specialReminderDaysBefore: 31, fixedRateEndMonthsBefore: [12, 12] };
    expect(keys(l)).toEqual(['err.notify.days', 'err.notify.months']);
  });
});
