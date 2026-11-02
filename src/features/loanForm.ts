import {
  defaultFirstPaymentDate,
  type Loan,
  type LoanParams,
  type PaymentMode,
  type SpecialRepaymentRule,
} from '@alp/core';
import { create } from 'zustand';

import type { AppLanguage } from '@/i18n';

import { createFormatter, parseMoneyInput, parsePercentInput } from './format';

/** Text-based form state of the "New / edit loan" panel (§6.3). Kept in the store across layout switches. */
export interface RuleForm {
  id: string;
  frequency: 'monthly' | 'yearly';
  month: number;
  amount: string;
  start: string;
  end?: string;
}

export interface LoanForm {
  base: Loan;
  name: string;
  lender: string;
  notes: string;
  principal: string;
  helper?: { purchasePrice: string; incidentalCosts: string; equity: string };
  rate: string;
  fixedPreset: '60' | '120' | '180' | 'custom';
  fixedMonths: string;
  payoutDate?: string;
  firstPaymentDate?: string;
  firstPaymentTouched: boolean;
  mode: PaymentMode;
  initialRepayment: string;
  termYears: string;
  amount: string;
  rules: RuleForm[];
  followUpRate: string;
  followUpMode: 'keepPayment' | 'repaymentRate';
  followUpRepayment: string;
  keepSpecialRules: boolean;
  rounding: 'bank' | 'spreadsheet';
  contractUnlocked: boolean;
}

export function formFromLoan(loan: Loan, lang: AppLanguage): LoanForm {
  const f = createFormatter(lang);
  const p = loan.params;
  const fixed = String(p.fixedRateMonths);
  const pay = p.payment;
  return {
    base: loan,
    name: loan.name,
    lender: loan.lender ?? '',
    notes: loan.notes ?? '',
    principal: f.moneyInput(p.principal),
    helper: p.financingHelper && {
      purchasePrice: f.moneyInput(p.financingHelper.purchasePrice),
      incidentalCosts: f.moneyInput(p.financingHelper.incidentalCosts),
      equity: f.moneyInput(p.financingHelper.equity),
    },
    rate: f.percentInput(p.nominalRate),
    fixedPreset: fixed === '60' || fixed === '120' || fixed === '180' ? fixed : 'custom',
    fixedMonths: fixed,
    payoutDate: p.payoutDate,
    firstPaymentDate: p.firstPaymentDate,
    firstPaymentTouched: p.firstPaymentDate !== defaultFirstPaymentDate(p.payoutDate),
    mode: pay.mode,
    initialRepayment: pay.mode === 'initialRepayment' ? f.percentInput(pay.initialRepaymentRate) : '2',
    termYears: pay.mode === 'term' ? f.percentInput(String(pay.termMonths / 12 / 100)) : '25',
    amount: pay.mode === 'fixedAmount' ? f.moneyInput(pay.amount) : '',
    rules: loan.specialRules.map((r) => ({
      id: r.id,
      frequency: r.frequency,
      month: r.month ?? 12,
      amount: f.moneyInput(r.amount),
      start: r.start,
      end: r.end,
    })),
    followUpRate: f.percentInput(loan.followUp.rate),
    followUpMode: loan.followUp.payment.mode,
    followUpRepayment: loan.followUp.payment.mode === 'repaymentRate' ? f.percentInput(loan.followUp.payment.rate) : '2',
    keepSpecialRules: loan.followUp.keepSpecialRules,
    rounding: p.rounding,
    contractUnlocked: false,
  };
}

export interface FormResult {
  loan?: Loan;
  /** Parse errors by core validation path. */
  parseErrors: Record<string, string>;
}

/** Builds the loan from the form. Unparsable numbers become parse errors (message key err.number). */
export function loanFromForm(form: LoanForm, lang: AppLanguage): FormResult {
  const errors: Record<string, string> = {};
  const money = (path: string, text: string) => {
    const v = parseMoneyInput(text, lang);
    if (v === undefined) errors[path] = 'err.number';
    return v ?? '0.00';
  };
  const rate = (path: string, text: string) => {
    const v = parsePercentInput(text, lang);
    if (v === undefined) errors[path] = 'err.number';
    return v ?? '0';
  };

  const fixedRateMonths = form.fixedPreset === 'custom' ? Number(form.fixedMonths) : Number(form.fixedPreset);
  if (!Number.isFinite(fixedRateMonths)) errors['params.fixedRateMonths'] = 'err.number';

  let payment: LoanParams['payment'];
  switch (form.mode) {
    case 'initialRepayment':
      payment = { mode: 'initialRepayment', initialRepaymentRate: rate('params.payment.initialRepaymentRate', form.initialRepayment) };
      break;
    case 'term': {
      const years = Number((form.termYears || '').replace(',', '.'));
      if (!Number.isFinite(years) || form.termYears.trim() === '') errors['params.payment.termMonths'] = 'err.number';
      payment = { mode: 'term', termMonths: Math.round(years * 12) };
      break;
    }
    case 'fixedAmount':
      payment = { mode: 'fixedAmount', amount: money('params.payment.amount', form.amount) };
      break;
  }

  const nominalRate = rate('params.nominalRate', form.rate);
  const params: LoanParams = {
    principal: money('params.principal', form.principal),
    nominalRate,
    payoutDate: form.payoutDate ?? '',
    firstPaymentDate: form.firstPaymentDate ?? '',
    fixedRateMonths: Number.isFinite(fixedRateMonths) ? fixedRateMonths : 0,
    payment,
    rounding: form.rounding,
  };
  if (form.helper) {
    params.financingHelper = {
      purchasePrice: money('params.financingHelper', form.helper.purchasePrice),
      incidentalCosts: money('params.financingHelper', form.helper.incidentalCosts),
      equity: money('params.financingHelper', form.helper.equity),
    };
  }

  const rules: SpecialRepaymentRule[] = form.rules.map((r, idx) => ({
    id: r.id,
    frequency: r.frequency,
    ...(r.frequency === 'yearly' ? { month: r.month } : {}),
    amount: money(`specialRules.${idx}.amount`, r.amount),
    start: r.start,
    ...(r.end ? { end: r.end } : {}),
  }));

  const loan: Loan = {
    ...form.base,
    name: form.name.trim(),
    lender: form.lender.trim() || undefined,
    notes: form.notes.trim() || undefined,
    params,
    specialRules: rules,
    followUp: {
      rate: rate('followUp.rate', form.followUpRate),
      payment:
        form.followUpMode === 'keepPayment'
          ? { mode: 'keepPayment' }
          : { mode: 'repaymentRate', rate: rate('followUp.payment.rate', form.followUpRepayment) },
      keepSpecialRules: form.keepSpecialRules,
    },
  };
  return { loan: Object.keys(errors).length === 0 ? loan : undefined, parseErrors: errors };
}

/** Unsaved drafts survive layout switches and remounts (§4.12 rule 9). */
export const useDraftStore = create<{ drafts: Record<string, LoanForm | undefined>; set(key: string, f: LoanForm | undefined): void }>((set, get) => ({
  drafts: {},
  set: (key, f) => set({ drafts: { ...get().drafts, [key]: f } }),
}));
