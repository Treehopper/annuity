import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatLocale, type AppLanguage } from '@/i18n';

/** Locale-aware formatting over Intl (§4.1). Currency is always EUR. */
export function createFormatter(lang: AppLanguage) {
  const locale = formatLocale(lang);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyRound = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const plain2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const plain0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const pctInput = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false });
  const moneyInput = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const decimalSep = lang === 'de' ? ',' : '.';

  const parts = (iso: string) => ({ y: iso.slice(0, 4), m: iso.slice(5, 7), d: iso.slice(8, 10) });

  return {
    lang,
    locale,
    decimalSep,
    /** 1.690,28 € / €1,690.28 */
    money: (m: string | number) => money.format(Number(m)),
    /** Rounded to whole euros. */
    moneyRound: (m: string | number) => moneyRound.format(Number(m)),
    /** Amount without currency, 2 decimals. */
    amount: (m: string | number) => plain2.format(Number(m)),
    integer: (n: number) => plain0.format(n),
    /** Signed delta, e.g. +75,95 €. */
    moneyDelta: (m: number) => (m > 0.004 ? '+' : m < -0.004 ? '−' : '±') + money.format(Math.abs(m)),
    /** Rate fraction to percent: '0.0308' → '3,08 %' / '3.08%'. */
    percent: (rate: string | number) => {
      const s = pct.format(Number(rate) * 100);
      return lang === 'de' ? `${s} %` : `${s}%`;
    },
    /** For input fields: percent without symbol and grouping. */
    percentInput: (rate: string) => pctInput.format(Number(rate) * 100),
    moneyInput: (m: string) => moneyInput.format(Number(m)),
    /** 01.10.2026 / 10/01/2026 */
    date: (iso: string) => {
      const { y, m, d } = parts(iso);
      return lang === 'de' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
    },
    /** 06/2034 (EN) or 06.2034 (DE) — matches the mockups. */
    monthYear: (iso: string) => {
      const { y, m } = parts(iso);
      return lang === 'de' ? `${m}.${y}` : `${m}/${y}`;
    },
    /** Duration in months as "5 y 10 mo" style pieces. */
    yearsMonths: (months: number) => ({ years: Math.floor(Math.abs(months) / 12), months: Math.abs(months) % 12 }),
  };
}

export type Formatter = ReturnType<typeof createFormatter>;

export function useFormat(): Formatter {
  const { i18n } = useTranslation();
  const lang = (i18n.language === 'de' ? 'de' : 'en') as AppLanguage;
  return useMemo(() => createFormatter(lang), [lang]);
}

/**
 * Parses a user-entered decimal number. Accepts the locale's decimal separator and
 * grouping (e.g. "280.000,00" in German, "280,000.00" in English) and plain input
 * with either separator. Returns undefined if not a number.
 */
export function parseDecimalInput(text: string, lang: AppLanguage, allowGrouping = true): string | undefined {
  let s = text.replace(/[\s  €%]/g, '');
  if (s === '') return undefined;
  const dec = lang === 'de' ? ',' : '.';
  const grp = lang === 'de' ? '.' : ',';
  const hasDec = s.includes(dec);
  const hasGrp = s.includes(grp);
  if (hasDec && hasGrp) {
    s = s.split(grp).join('').replace(dec, '.');
  } else if (hasDec) {
    s = s.replace(dec, '.');
  } else if (hasGrp) {
    // Only the "other" separator: grouping if it splits off exactly 3 digits, otherwise a decimal point.
    const groups = s.split(grp);
    const looksGrouped = allowGrouping && groups.length > 1 && groups.slice(1).every((g) => g.length === 3);
    s = looksGrouped ? groups.join('') : s.replace(grp, '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  return s;
}

/** Parses money input to canonical form ('280000.00'), or undefined. */
export function parseMoneyInput(text: string, lang: AppLanguage): string | undefined {
  const v = parseDecimalInput(text, lang);
  if (v === undefined) return undefined;
  return Number(v).toFixed(2);
}

/** Parses a percent input ('3,08') to a canonical rate fraction ('0.0308'). */
export function parsePercentInput(text: string, lang: AppLanguage): string | undefined {
  const v = parseDecimalInput(text, lang, false);
  if (v === undefined) return undefined;
  // Exact decimal shift by string manipulation avoids float artefacts.
  const [int = '0', frac = ''] = v.replace('-', '').split('.');
  const digits = (int.padStart(3, '0') + frac).replace(/^0+(?=\d)/, '');
  const padded = digits.padStart(frac.length + 3, '0');
  const cut = padded.length - frac.length - 2;
  let r = `${padded.slice(0, cut)}.${padded.slice(cut)}`.replace(/^0+(?=\d)/, '');
  r = r.replace(/\.?0+$/, '');
  if (r === '' || r.startsWith('.')) r = '0' + r;
  return (v.startsWith('-') ? '-' : '') + r;
}
