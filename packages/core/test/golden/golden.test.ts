/** Golden tests G1–G6, G8–G10 (README §5.7). */
import { aggregateYearly, buildSchedule, computeKpis, type Loan, type ScheduleRow } from '../../src';
import { loan, monthly1100 } from '../fixtures';

const TODAY = '2026-10-15';

function run(l: Loan, opts: Parameters<typeof buildSchedule>[1] = {}) {
  const schedule = buildSchedule(l, { today: TODAY, ...opts });
  const kpis = computeKpis(l, schedule, TODAY);
  return { schedule, kpis, last: schedule[schedule.length - 1] as ScheduleRow };
}

const row = (s: ScheduleRow[], date: string) => s.find((r) => r.date === date) as ScheduleRow;

describe('G1: calculator 1, spreadsheet mode', () => {
  const l = loan({ rounding: 'spreadsheet', fixedRateMonths: 216 }, { rules: [monthly1100] });
  const { schedule, kpis } = run(l);

  it('annuity is unrounded 1,690.2841…', () => {
    expect(kpis.annuity).toBe('1690.28');
  });
  it('row 1', () => {
    const r1 = schedule[0]!;
    expect(r1.interest).toBe('718.67');
    expect(r1.regularPrincipal).toBe('971.62');
    expect(r1.special).toBe('1100.00');
    expect(r1.closing).toBe('277928.38');
  });
  it('row 116 and totals', () => {
    expect(schedule[115]!.closing).toBe('501.97');
    expect(schedule).toHaveLength(117);
    expect(kpis.payoff.totalInterest).toBe('44176.22');
  });
});

describe('G2: as G1, fixed 60 months, bank mode', () => {
  const l = loan({ fixedRateMonths: 60 }, { rules: [monthly1100] });
  const { schedule, kpis, last } = run(l);
  it('payoff', () => {
    expect(schedule).toHaveLength(117);
    expect(last.payment).toBe('503.76');
    expect(last.special).toBe('0.00');
    expect(kpis.payoff.totalInterest).toBe('44176.24');
    expect(kpis.payoff.totalSpecial).toBe('127600.00');
  });
  it('fixed-rate end', () => {
    expect(kpis.atFixedRateEnd.date).toBe('2029-06-01');
    expect(kpis.atFixedRateEnd.balance).toBe('145807.24');
    expect(kpis.atFixedRateEnd.interestPaid).toBe('33224.04');
    expect(kpis.atFixedRateEnd.paidOffBeforeEnd).toBe(false);
  });
});

describe('G3: as G1 without special repayments, fixed 120, bank', () => {
  const { schedule, kpis, last } = run(loan({ fixedRateMonths: 120 }));
  it('residual payment', () => {
    expect(schedule).toHaveLength(217);
    expect(last.payment).toBe('1.31');
    expect(kpis.payoff.totalInterest).toBe('85101.79');
    expect(kpis.atFixedRateEnd.balance).toBe('143659.68');
    expect(kpis.atFixedRateEnd.interestPaid).toBe('66493.28');
  });
});

const calc2 = { nominalRate: '0.0332', payment: { mode: 'initialRepayment', initialRepaymentRate: '0.086' } } as const;

describe('G4: calculator 2, spreadsheet mode', () => {
  const { schedule, kpis } = run(loan({ ...calc2, rounding: 'spreadsheet', fixedRateMonths: 240 }));
  it('values', () => {
    expect(kpis.annuity).toBe('2781.33');
    expect(schedule[0]!.interest).toBe('774.67');
    expect(schedule[0]!.regularPrincipal).toBe('2006.67');
    expect(schedule).toHaveLength(119);
    expect(kpis.payoff.totalInterest).toBe('48640.43');
  });
});

describe('G5: as G4, fixed 60, bank', () => {
  const { schedule, kpis, last } = run(loan({ ...calc2, fixedRateMonths: 60 }));
  it('values', () => {
    expect(schedule).toHaveLength(119);
    expect(last.payment).toBe('443.43');
    expect(kpis.payoff.totalInterest).toBe('48640.37');
    expect(kpis.atFixedRateEnd.balance).toBe('149226.56');
    expect(kpis.atFixedRateEnd.interestPaid).toBe('36106.36');
  });
});

describe('G6: G2 with overrides', () => {
  const l = loan(
    { fixedRateMonths: 60 },
    {
      rules: [monthly1100],
      overrides: [
        { id: 'o1', date: '2025-03-01', kind: 'skipped', confirmed: true },
        { id: 'o2', date: '2025-12-01', kind: 'additional', amount: '5000.00', confirmed: true },
      ],
    },
  );
  const { schedule, kpis, last } = run(l);
  it('values', () => {
    expect(row(schedule, '2025-03-01').special).toBe('0.00');
    expect(row(schedule, '2025-12-01').special).toBe('6100.00');
    expect(schedule).toHaveLength(115);
    expect(kpis.payoff.date).toBe('2034-01-01');
    expect(last.payment).toBe('1106.65');
    expect(kpis.payoff.totalInterest).toBe('43098.57');
    expect(kpis.payoff.totalSpecial).toBe('129300.00');
    expect(kpis.atFixedRateEnd.balance).toBe('141492.56');
    expect(kpis.atFixedRateEnd.interestPaid).toBe('32809.36');
  });
});

const g8Overrides = [{ id: 'o1', date: '2026-11-01', kind: 'changed', amount: '800.00', confirmed: false } as const];

describe('G8: correction 2026-11 changed to 800 €', () => {
  const l = loan({ fixedRateMonths: 120 }, { rules: [monthly1100], overrides: [...g8Overrides] });
  const { schedule, kpis, last } = run(l);
  const plan = run(loan({ fixedRateMonths: 120 }, { rules: [monthly1100] }));
  it('values', () => {
    expect(schedule).toHaveLength(117);
    expect(kpis.payoff.date).toBe('2034-03-01');
    const oct = row(schedule, '2026-10-01');
    expect(oct.interest).toBe('570.21');
    expect(oct.regularPrincipal).toBe('1120.07');
    expect(oct.closing).toBe('219939.51');
    expect(last.payment).toBe('879.71');
    expect(last.interest).toBe('2.25');
    expect(last.regularPrincipal).toBe('877.46');
    expect(kpis.payoff.totalInterest).toBe('44252.19');
    expect(Number(kpis.payoff.totalInterest) - Number(plan.kpis.payoff.totalInterest)).toBeCloseTo(75.95, 2);
    expect(kpis.payoff.totalSpecial).toBe('127300.00');
    expect(kpis.atFixedRateEnd.balance).toBe('0.00');
    expect(kpis.atFixedRateEnd.paidOffBeforeEnd).toBe(true);
  });
  it('mockup row 2026-11 (§6.6)', () => {
    const nov = row(schedule, '2026-11-01');
    expect(nov.interest).toBe('564.51');
    expect(nov.regularPrincipal).toBe('1125.77');
    expect(nov.special).toBe('800.00');
    expect(nov.closing).toBe('218013.74');
  });
});

describe('G9: follow-up 4.00 % keep payment', () => {
  const l = loan(
    { nominalRate: '0.0295', payment: { mode: 'initialRepayment', initialRepaymentRate: '0.04' }, fixedRateMonths: 60 },
    { rules: [monthly1100] },
  );
  l.followUp = { rate: '0.04', payment: { mode: 'keepPayment' }, keepSpecialRules: true };
  const { schedule, kpis, last } = run(l);
  it('values', () => {
    expect(kpis.annuity).toBe('1621.67');
    expect(kpis.atFixedRateEnd.date).toBe('2029-06-01');
    expect(kpis.atFixedRateEnd.balance).toBe('148716.55');
    expect(schedule).toHaveLength(121);
    expect(kpis.payoff.date).toBe('2034-07-01');
    expect(kpis.payoff.isEstimate).toBe(true);
    expect(last.payment).toBe('1142.23');
    expect(kpis.payoff.totalInterest).toBe('47742.63');
  });
});

describe('G10: G8 as active loan, without special repayments, today 2026-10-15', () => {
  const l = loan({ fixedRateMonths: 120 }, { status: 'active', rules: [monthly1100], overrides: [...g8Overrides] });
  const { schedule, kpis, last } = run(l, { withoutSpecial: true });
  it('values', () => {
    expect(schedule[27]!.date).toBe('2026-10-01');
    expect(schedule[27]!.special).toBe('1100.00');
    expect(schedule[28]!.special).toBe('0.00');
    expect(kpis.payoff.totalSpecial).toBe('30800.00');
    expect(schedule).toHaveLength(187);
    expect(kpis.payoff.date).toBe('2040-01-01');
    expect(kpis.payoff.isEstimate).toBe(true);
    expect(last.payment).toBe('933.15');
    expect(kpis.payoff.totalInterest).toBe('66125.23');
    expect(kpis.atFixedRateEnd.date).toBe('2034-06-01');
    expect(kpis.atFixedRateEnd.balance).toBe('103286.40');
  });
  it('yearly aggregation splits the fixed-rate end year', () => {
    const years = aggregateYearly(schedule, 120).filter((y) => y.year === 2034);
    expect(years.map((y) => y.part)).toEqual(['fixed', 'followUp']);
    expect(years[0]!.payments + years[1]!.payments).toBe(12);
  });
});
