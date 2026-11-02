import { defaultSettings, newLoanTemplate, validateLoan } from '@alp/core';

import { applyFormPatch, formFromLoan, loanFromForm, newRuleForm, relocalizeForm, type LoanForm } from './loanForm';

const template = () => newLoanTemplate({ id: 'x', today: '2026-11-02', now: '2026-11-02T00:00:00Z', settings: defaultSettings() });
const errors = (form: LoanForm) => {
  const { loan, parseErrors } = loanFromForm(form);
  return [...Object.keys(parseErrors), ...(loan ? validateLoan(loan).filter((i) => i.severity === 'error').map((i) => i.path) : [])];
};

describe('new loan defaults', () => {
  it('10-year fixed rate and payment by amount', () => {
    const form = formFromLoan(template(), 'en');
    expect(form.fixedPreset).toBe('120');
    expect(form.mode).toBe('fixedAmount');
    expect(form.amount).toBe('1,375.00');
    expect(errors({ ...form, name: 'A' })).toEqual([]);
  });

  it('a new rule is yearly in January and ends with the fixed-rate period', () => {
    const form = formFromLoan(template(), 'en');
    const rule = newRuleForm(form, 'r');
    expect(rule).toMatchObject({ frequency: 'yearly', month: 1, start: '2027-01-01', end: '2036-12-01', endFollowsFixed: true });
  });
});

describe('name follows the lender', () => {
  it('until the name is edited', () => {
    let form = formFromLoan(template(), 'en');
    expect(form.nameTouched).toBe(false);
    form = applyFormPatch(form, { lender: 'DummyBank' });
    expect(form.name).toBe('DummyBank');
    form = applyFormPatch(form, { name: 'DummyBank 10y', nameTouched: true });
    form = applyFormPatch(form, { lender: 'Other Bank' });
    expect(form.name).toBe('DummyBank 10y');
  });

  it('existing loans keep following only if the name equals the lender', () => {
    expect(formFromLoan({ ...template(), name: 'B', lender: 'B' }, 'en').nameTouched).toBe(false);
    expect(formFromLoan({ ...template(), name: 'B 10y', lender: 'B' }, 'en').nameTouched).toBe(true);
  });
});

describe('rule end follows the fixed-rate end', () => {
  const withRule = () => {
    const form = formFromLoan(template(), 'en');
    return { ...form, rules: [newRuleForm(form, 'r')] };
  };

  it('when the period or the first payment changes', () => {
    let form = applyFormPatch(withRule(), { fixedPreset: '60', fixedMonths: '60' });
    expect(form.rules[0]!.end).toBe('2031-12-01');
    form = applyFormPatch(form, { firstPaymentDate: '2027-02-01' });
    expect(form.rules[0]!.end).toBe('2032-01-01');
  });

  it('but not once the user set it', () => {
    let form = withRule();
    form = applyFormPatch(form, { rules: [{ ...form.rules[0]!, end: '2030-01-01', endFollowsFixed: false }] });
    form = applyFormPatch(form, { fixedPreset: '180', fixedMonths: '180' });
    expect(form.rules[0]!.end).toBe('2030-01-01');
  });

  it('keeps the last value while a custom period is incomplete', () => {
    const form = applyFormPatch(withRule(), { fixedPreset: 'custom', fixedMonths: '' });
    expect(form.rules[0]!.end).toBe('2036-12-01');
  });
});

describe('language switch while a draft is open (regression)', () => {
  it.each([
    ['en', 'de'],
    ['de', 'en'],
  ] as const)('%s → %s keeps amounts valid', (from, to) => {
    const loan = { ...template(), name: 'A', specialRules: [{ id: 'r', frequency: 'yearly' as const, month: 1, amount: '5000.00', start: '2026-12-01' }] };
    const form = formFromLoan({ ...loan, params: { ...loan.params, nominalRate: '0.0308' }, followUp: { ...loan.followUp, rate: '0.0308' } }, from);
    const moved = relocalizeForm(form, to);
    expect(moved.lang).toBe(to);
    expect(moved.principal).toBe(to === 'de' ? '300.000,00' : '300,000.00');
    expect(moved.rate).toBe(to === 'de' ? '3,08' : '3.08');
    expect(errors(moved)).toEqual([]);
    expect(loanFromForm(moved).loan?.params).toEqual(loanFromForm(form).loan?.params);
    expect(loanFromForm(moved).loan?.specialRules[0]?.amount).toBe('5000.00');
  });

  it('leaves unparsable text as typed', () => {
    const form = { ...formFromLoan(template(), 'en'), principal: 'abc' };
    expect(relocalizeForm(form, 'de').principal).toBe('abc');
  });
});
