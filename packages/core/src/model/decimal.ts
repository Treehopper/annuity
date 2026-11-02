import DecimalBase from 'decimal.js-light';

/** Decimal with enough precision for unrounded (spreadsheet mode) schedules. */
export const Decimal = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_HALF_UP });
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value and type share the name, as in decimal.js
export type Decimal = InstanceType<typeof Decimal>;

export const ZERO = new Decimal(0);

export function dec(v: string | number | Decimal): Decimal {
  return new Decimal(v);
}

/** Round half-up to 0.01. */
export function round2(v: Decimal): Decimal {
  return v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function dmin(a: Decimal, b: Decimal): Decimal {
  return a.lte(b) ? a : b;
}

export function dmax(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}

/** Canonical money string: two fraction digits, '.' separator (§4.4). */
export function toMoney(v: Decimal): string {
  const s = round2(v).toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

/** Canonical rate string: fraction with at most 6 fraction digits, trailing zeros trimmed (§4.4). */
export function toRate(v: Decimal): string {
  let s = v.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
  s = s.replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

/** Percent number (e.g. 3.08) to canonical fraction string ('0.0308'). */
export function percentToRate(percent: string | number): string {
  return toRate(dec(percent).div(100));
}

export function rateToPercent(rate: string): Decimal {
  return dec(rate).times(100);
}

const MONEY_RE = /^-?\d+\.\d{2}$/;
const RATE_RE = /^-?\d+(\.\d{1,6})?$/;

export function isMoney(s: unknown): s is string {
  return typeof s === 'string' && MONEY_RE.test(s);
}

export function isRate(s: unknown): s is string {
  return typeof s === 'string' && RATE_RE.test(s);
}
