import {
  addMonths,
  defaultFirstPaymentDate,
  fixedRateEndDate,
  isISODate,
  type Loan,
  type LoanParams,
  type PaymentMode,
  type SpecialRepaymentRule,
} from '@alp/core';
import { create } from 'zustand';

import type { AppLanguage } from '@/i18n';

import { createFormatter, parseDecimalInput, parseMoneyInput, parsePercentInput } from './format';

/** Text-based form state of the "New / edit loan" panel (§6.3). Kept in the store across layout switches. */
export interface RuleForm {
  id: string;
  frequency: 'monthly' | 'yearly';
  month: number;
  amount: string;
  start: string;
  end?: string;
  /** The end date follows the end of the fixed-rate period until the user sets it. */
  endFollowsFixed: boolean;
}

export interface LoanForm {
  base: Loan;
  /** Language the number fields are formatted in. Parsing always uses this, not the current UI language. */
  lang: AppLanguage;
  name: string;
  /** The name follows the lender until the user edits it. */
  nameTouched: boolean;
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
  const fixedEnd = isISODate(p.firstPaymentDate) ? fixedRateEndDate(loan) : undefined;
  return {
    base: loan,
    lang,
    name: loan.name,
    nameTouched: loan.name !== (loan.lender ?? ''),
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
      month: r.month ?? 1,
      amount: f.moneyInput(r.amount),
      start: r.start,
      end: r.end,
      endFollowsFixed: r.end !== undefined && r.end === fixedEnd,
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
export function loanFromForm(form: LoanForm): FormResult {
  const lang = form.lang;
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

  const fixedRateMonths = formFixedMonths(form);
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

function formFixedMonths(form: LoanForm): number {
  return form.fixedPreset === 'custom' ? Number(form.fixedMonths) : Number(form.fixedPreset);
}

/** Last payment date of the fixed-rate period, or undefined while the inputs are incomplete. */
export function formFixedRateEnd(form: LoanForm): string | undefined {
  const months = formFixedMonths(form);
  if (!form.firstPaymentDate || !isISODate(form.firstPaymentDate) || !Number.isInteger(months) || months < 1) return undefined;
  return addMonths(form.firstPaymentDate, months - 1);
}

/**
 * Applies a field change and keeps the derived defaults in step: the name follows the lender
 * until edited, and rule end dates follow the fixed-rate end until set by the user.
 */
export function applyFormPatch(form: LoanForm, patch: Partial<LoanForm>): LoanForm {
  const next = { ...form, ...patch };
  if (!next.nameTouched) next.name = next.lender.slice(0, 80);
  const fixedEnd = formFixedRateEnd(next);
  if (fixedEnd && next.rules.some((r) => r.endFollowsFixed && r.end !== fixedEnd)) {
    next.rules = next.rules.map((r) => (r.endFollowsFixed ? { ...r, end: fixedEnd } : r));
  }
  return next;
}

/** A new special repayment rule: yearly in January, from the first payment to the fixed-rate end. */
export function newRuleForm(form: LoanForm, id: string): RuleForm {
  const end = formFixedRateEnd(form);
  return { id, frequency: 'yearly', month: 1, amount: '', start: form.firstPaymentDate ?? '', end, endFollowsFixed: true };
}

/**
 * Re-formats the number fields for another language. Drafts outlive a language switch in
 * Settings; without this, "300,000.00" typed in English would be read as 300 € in German.
 * Text that doesn't parse is left as typed.
 */
export function relocalizeForm(form: LoanForm, lang: AppLanguage): LoanForm {
  if (form.lang === lang) return form;
  const to = createFormatter(lang);
  const money = (s: string) => {
    const v = parseMoneyInput(s, form.lang);
    return v === undefined ? s : to.moneyInput(v);
  };
  const pct = (s: string) => {
    const v = parsePercentInput(s, form.lang);
    return v === undefined ? s : to.percentInput(v);
  };
  const years = (s: string) => {
    const v = parseDecimalInput(s, form.lang, false);
    return v === undefined ? s : to.percentInput(String(Number(v) / 100));
  };
  return {
    ...form,
    lang,
    principal: money(form.principal),
    helper: form.helper && {
      purchasePrice: money(form.helper.purchasePrice),
      incidentalCosts: money(form.helper.incidentalCosts),
      equity: money(form.helper.equity),
    },
    rate: pct(form.rate),
    initialRepayment: pct(form.initialRepayment),
    termYears: years(form.termYears),
    amount: money(form.amount),
    rules: form.rules.map((r) => ({ ...r, amount: money(r.amount) })),
    followUpRate: pct(form.followUpRate),
    followUpRepayment: pct(form.followUpRepayment),
  };
}

/** Unsaved drafts survive layout switches and remounts (§4.12 rule 9). */
export const useDraftStore = create<{ drafts: Record<string, LoanForm | undefined>; set(key: string, f: LoanForm | undefined): void }>((set, get) => ({
  drafts: {},
  set: (key, f) => set({ drafts: { ...get().drafts, [key]: f } }),
}));
