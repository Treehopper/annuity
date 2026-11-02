import { createFormatter, parseDecimalInput, parseMoneyInput, parsePercentInput } from './format';

describe('input parsing', () => {
  it('money in both languages', () => {
    expect(parseMoneyInput('280.000,00', 'de')).toBe('280000.00');
    expect(parseMoneyInput('280000', 'de')).toBe('280000.00');
    expect(parseMoneyInput('1690,28', 'de')).toBe('1690.28');
    expect(parseMoneyInput('280,000.00', 'en')).toBe('280000.00');
    expect(parseMoneyInput('1,100', 'en')).toBe('1100.00');
    expect(parseMoneyInput('1690.28 €', 'de')).toBe('1690.28');
    expect(parseMoneyInput('abc', 'en')).toBeUndefined();
  });
  it('percent to canonical rate without float drift', () => {
    expect(parsePercentInput('3,08', 'de')).toBe('0.0308');
    expect(parsePercentInput('3.08', 'de')).toBe('0.0308');
    expect(parsePercentInput('8.6', 'en')).toBe('0.086');
    expect(parsePercentInput('0,5', 'de')).toBe('0.005');
    expect(parsePercentInput('20', 'en')).toBe('0.2');
    expect(parsePercentInput('0', 'en')).toBe('0');
    expect(parsePercentInput('3.085', 'en')).toBe('0.03085');
  });
  it('rejects garbage', () => {
    expect(parseDecimalInput('1.2.3,4,5', 'de')).toBeUndefined();
    expect(parseDecimalInput('', 'de')).toBeUndefined();
  });
});

describe('formatting follows the resolved language (DL-21)', () => {
  it('German', () => {
    const f = createFormatter('de');
    expect(f.money('1690.28').replace(/\s/g, ' ')).toBe('1.690,28 €');
    expect(f.percent('0.0308')).toBe('3,08 %');
    expect(f.date('2026-10-01')).toBe('01.10.2026');
    expect(f.monthYear('2034-06-01')).toBe('06.2034');
  });
  it('English', () => {
    const f = createFormatter('en');
    expect(f.money('1690.28')).toBe('€1,690.28');
    expect(f.percent('0.0308')).toBe('3.08%');
    expect(f.monthYear('2034-06-01')).toBe('06/2034');
    expect(f.moneyDelta(75.95)).toBe('+€75.95');
  });
});
