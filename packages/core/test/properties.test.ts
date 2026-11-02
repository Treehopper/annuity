/** Property-based tests (§5.7). */
import * as fc from 'fast-check';
import { buildSchedule, percentToRate, toMoney, type Loan } from '../src';
import { dec } from '../src/model/decimal';
import { loan } from './fixtures';

const arbLoan: fc.Arbitrary<Loan> = fc
  .record({
    principal: fc.integer({ min: 1000, max: 2_000_000 }),
    ratePermille: fc.integer({ min: 0, max: 120 }),
    mode: fc.constantFrom('term', 'initialRepayment'),
    term: fc.integer({ min: 12, max: 480 }),
    repaymentPermille: fc.integer({ min: 10, max: 150 }),
    fixed: fc.integer({ min: 12, max: 240 }),
    special: fc.integer({ min: 0, max: 5000 }),
    rounding: fc.constantFrom('bank' as const, 'spreadsheet' as const),
  })
  .map((x) =>
    loan(
      {
        principal: `${x.principal}.00`,
        nominalRate: percentToRate(x.ratePermille / 10),
        payment:
          x.mode === 'term'
            ? { mode: 'term', termMonths: x.term }
            : { mode: 'initialRepayment', initialRepaymentRate: percentToRate(x.repaymentPermille / 10) },
        fixedRateMonths: x.fixed,
        rounding: x.rounding,
      },
      { rules: x.special ? [{ id: 'r', frequency: 'monthly', amount: `${x.special}.00`, start: '2024-07-01' }] : [] },
    ),
  );

describe('schedule properties', () => {
  it('principal + special sums to the loan amount; balance never negative and decreasing', () => {
    fc.assert(
      fc.property(arbLoan, (l) => {
        const s = buildSchedule(l);
        let sum = dec(0);
        let prev = dec(l.params.principal);
        for (const r of s) {
          const closing = dec(r.closing);
          expect(closing.gte(0)).toBe(true);
          expect(closing.lt(prev)).toBe(true);
          prev = closing;
          sum = sum.plus(dec(r.regularPrincipal)).plus(dec(r.special));
        }
        if (l.params.rounding === 'bank' && s.length < 600) expect(toMoney(sum)).toBe(l.params.principal);
        if (s.length < 600) expect(s[s.length - 1]!.closing).toBe('0.00');
      }),
      { numRuns: 300 },
    );
  });
});
