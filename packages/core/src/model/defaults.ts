import { addMonths, firstOfMonth } from './dates';
import type { CsvExportDefaults, FollowUpAssumption, ISODate, Loan, LoanNotificationPrefs, LoanParams, Settings } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export const CSV_PRESETS: Record<'de' | 'en' | 'universal', Omit<CsvExportDefaults, 'granularity' | 'projection' | 'includeParams'>> = {
  de: { preset: 'de', delimiter: ';', decimal: ',', thousands: '', dateFormat: 'DD.MM.YYYY', encoding: 'utf8bom', headerLanguage: 'de' },
  en: { preset: 'en', delimiter: ',', decimal: '.', thousands: '', dateFormat: 'YYYY-MM-DD', encoding: 'utf8', headerLanguage: 'en' },
  universal: { preset: 'universal', delimiter: ',', decimal: '.', thousands: '', dateFormat: 'YYYY-MM-DD', encoding: 'utf8', headerLanguage: 'en' },
};

export function defaultNotificationPrefs(): LoanNotificationPrefs {
  return { monthlyBreakdown: false, specialReminderDaysBefore: 3, fixedRateEndMonthsBefore: [12, 6] };
}

export function defaultSettings(language: 'de' | 'en' = 'en'): Settings {
  return {
    language: 'system',
    appearance: 'system',
    palette: 'classic',
    overviewSort: { key: 'payoffDate', direction: 'asc' },
    overviewFilter: 'all',
    csvDefaults: { ...CSV_PRESETS[language], granularity: 'monthly', projection: 'current', includeParams: true },
    notifications: {
      monthlyBreakdown: true,
      specialReminder: true,
      fixedRateEnd: true,
      newLoanDefaults: defaultNotificationPrefs(),
    },
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function defaultFollowUp(nominalRate: string): FollowUpAssumption {
  return { rate: nominalRate, payment: { mode: 'keepPayment' }, keepSpecialRules: true };
}

/** Planned dates for a new loan: payout on the 1st of next month, first payment a month later (§5.11). */
export function defaultLoanDates(today: ISODate): Pick<LoanParams, 'payoutDate' | 'firstPaymentDate'> {
  const payoutDate = addMonths(firstOfMonth(today), 1);
  return { payoutDate, firstPaymentDate: addMonths(payoutDate, 1) };
}

/** Default first payment for a payout date: the 1st of the following month (F4). */
export function defaultFirstPaymentDate(payoutDate: ISODate): ISODate {
  return addMonths(firstOfMonth(payoutDate), 1);
}

/** Template for the "New loan" form. Not valid until the user fills in name, amount and rate. */
export function newLoanTemplate(args: { id: string; today: ISODate; now: string; settings: Settings }): Loan {
  const nominalRate = '0.035';
  return {
    id: args.id,
    name: '',
    status: 'offer',
    params: {
      principal: '300000.00',
      nominalRate,
      ...defaultLoanDates(args.today),
      fixedRateMonths: 120,
      payment: { mode: 'initialRepayment', initialRepaymentRate: '0.02' },
      rounding: 'bank',
    },
    specialRules: [],
    specialOverrides: [],
    followUp: defaultFollowUp(nominalRate),
    notifications: structuredCloneJson(args.settings.notifications.newLoanDefaults),
    createdAt: args.now,
    updatedAt: args.now,
  };
}

export function structuredCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
