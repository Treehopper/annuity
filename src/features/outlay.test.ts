import i18n from '@/i18n';

import { createFormatter } from './format';
import { outlayBreakdown, specialSummary } from './outlay';

/** Intl puts a no-break space before "€". */
const plain = (s: string | undefined) => s?.replace(/\u00a0/g, ' ');

const parts = (monthlySpecial: string, yearlySpecials: { month: number; amount: string }[] = []) => ({
  annuity: '1701.00',
  outlayParts: { monthlySpecial, yearlySpecials },
});

describe('outlay breakdown text', () => {
  beforeAll(() => i18n.changeLanguage('de'));
  const f = createFormatter('de');
  const t = i18n.t.bind(i18n);

  it('names the payment and when each special repayment is due', () => {
    expect(plain(outlayBreakdown(parts('0.00', [{ month: 12, amount: '5000.00' }]), f, t))).toBe('1.701,00 € Rate + 5.000,00 € jährlich im Dezember');
    expect(plain(outlayBreakdown(parts('1100.00'), f, t))).toBe('1.701,00 € Rate + 1.100,00 € monatlich');
  });
  it('is omitted when the outlay is just the payment', () => {
    expect(outlayBreakdown(parts('0.00'), f, t)).toBeUndefined();
    expect(specialSummary(parts('0.00'), f, t)).toBeUndefined();
  });
  it('overview card shows yearly specials per year, not as a monthly average', () => {
    expect(plain(specialSummary(parts('1100.00', [{ month: 3, amount: '1000.00' }, { month: 12, amount: '5000.00' }]), f, t))).toBe('1.100,00 € + 6.000,00 €/Jahr');
  });
});
