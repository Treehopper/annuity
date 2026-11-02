/** Public API of @alp/core (README §4.7). The frontend imports only from here. */
export * from './model/types';
export * from './model/defaults';
export {
  addMonths,
  addDays,
  compareDates,
  firstOfMonth,
  isISODate,
  monthsBetween,
  parseISODate,
  yearMonth,
} from './model/dates';
export { isMoney, isRate, percentToRate, toMoney, toRate } from './model/decimal';
export * from './engine/annuity';
export { buildSchedule, followUpPayment, MAX_ROWS, type ScheduleOptions } from './engine/schedule';
export * from './engine/kpis';
export * from './engine/compare';
export * from './engine/yearly';
export { validateLoan, validateNotificationPrefs, hasErrors } from './validation/validateLoan';
export { migrateDocuments } from './migrations';
export * from './ports';
export type { PlannedNotification } from './services/notifications';
export { createCore, type Core, type Result } from './services/createCore';
