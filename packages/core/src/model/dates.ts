import type { ISODate } from './types';

/** Date helpers on 'YYYY-MM-DD' strings. No Date objects, no time zones (§4.1). */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface YMD {
  y: number;
  m: number; // 1..12
  d: number;
}

export function parseISODate(s: ISODate): YMD {
  const m = ISO_RE.exec(s);
  if (!m) throw new Error(`Invalid ISO date: ${s}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function formatISODate({ y, m, d }: YMD): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
}

/**
 * Adds months, keeping the original day-of-month and clamping it to the month's
 * length (Jan 31 → Feb 28/29 → Mar 31 when always computed from the same origin, §5.3).
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const { y, m, d } = parseISODate(date);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return formatISODate({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) });
}

export function addDays(date: ISODate, days: number): ISODate {
  // Julian day number arithmetic, independent of time zones.
  return fromDayNumber(toDayNumber(date) + days);
}

function toDayNumber(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function fromDayNumber(jdn: number): ISODate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return formatISODate({
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  });
}

/** 'YYYY-MM' of a date. */
export function yearMonth(date: ISODate): string {
  return date.slice(0, 7);
}

export function firstOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

/** Whole months from a to b, by calendar month (ignores the day). */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
