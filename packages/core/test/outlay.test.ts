import { buildSchedule, computeKpis } from '../src';
import { loan } from './fixtures';

describe('monthly outlay breakdown (§5.10)', () => {
  const l = loan(
    { payment: { mode: 'fixedAmount', amount: '1701.00' } },
    {
      rules: [
        { id: 'm', frequency: 'monthly', amount: '100.00', start: '2024-07-01' },
        { id: 'd1', frequency: 'yearly', month: 12, amount: '3000.00', start: '2024-07-01' },
        { id: 'd2', frequency: 'yearly', month: 12, amount: '2000.00', start: '2024-07-01' },
        { id: 'mar', frequency: 'yearly', month: 3, amount: '1200.00', start: '2024-07-01' },
        { id: 'later', frequency: 'yearly', month: 6, amount: '9999.00', start: '2030-01-01' },
      ],
    },
  );
  const kpis = computeKpis(l, buildSchedule(l, { today: '2026-10-15' }), '2026-10-15');

  it('averages yearly rules over 12 months', () => {
    // 1701 + 100 + (3000 + 2000 + 1200) / 12
    expect(kpis.monthlyOutlay).toBe('2317.67');
  });
  it('lists monthly and yearly parts, yearly merged by month and sorted, inactive rules left out', () => {
    expect(kpis.outlayParts).toEqual({
      monthlySpecial: '100.00',
      yearlySpecials: [
        { month: 3, amount: '1200.00' },
        { month: 12, amount: '5000.00' },
      ],
    });
  });
});
