/** Domain model (README §4.4). Persisted shapes use canonical string formats. */

export type ISODate = string; // 'YYYY-MM-DD'
export type Money = string; // canonical, e.g. '280000.00'
export type Rate = string; // canonical fraction, e.g. '0.0308'

export type LoanStatus = 'offer' | 'active' | 'closed';

export interface Loan {
  id: string;
  name: string;
  lender?: string;
  status: LoanStatus;
  params: LoanParams;
  specialRules: SpecialRepaymentRule[];
  specialOverrides: SpecialRepaymentOverride[];
  followUp: FollowUpAssumption;
  baseline?: LoanBaseline;
  notifications: LoanNotificationPrefs;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanBaseline {
  params: LoanParams;
  specialRules: SpecialRepaymentRule[];
  followUp: FollowUpAssumption;
  createdAt: string;
}

export interface FinancingHelper {
  purchasePrice: Money;
  incidentalCosts: Money;
  equity: Money;
}

export type PaymentDefinition =
  | { mode: 'initialRepayment'; initialRepaymentRate: Rate }
  | { mode: 'term'; termMonths: number }
  | { mode: 'fixedAmount'; amount: Money };

export type PaymentMode = PaymentDefinition['mode'];

export interface LoanParams {
  principal: Money;
  financingHelper?: FinancingHelper;
  nominalRate: Rate;
  payoutDate: ISODate;
  firstPaymentDate: ISODate;
  fixedRateMonths: number;
  payment: PaymentDefinition;
  rounding: 'bank' | 'spreadsheet';
}

export interface SpecialRepaymentRule {
  id: string;
  frequency: 'monthly' | 'yearly';
  month?: number;
  amount: Money;
  start: ISODate;
  end?: ISODate;
}

export type OverrideKind = 'asPlanned' | 'changed' | 'skipped' | 'additional';

export interface SpecialRepaymentOverride {
  id: string;
  date: ISODate;
  kind: OverrideKind;
  amount?: Money;
  confirmed: boolean;
  note?: string;
}

export interface FollowUpAssumption {
  rate: Rate;
  payment: { mode: 'keepPayment' } | { mode: 'repaymentRate'; rate: Rate };
  keepSpecialRules: boolean;
}

export interface LoanNotificationPrefs {
  monthlyBreakdown: boolean;
  specialReminderDaysBefore?: number;
  fixedRateEndMonthsBefore: number[];
}

export type PaletteId = 'classic' | 'solarized' | 'nord' | 'gruvbox' | 'catppuccin';
export const PALETTE_IDS: readonly PaletteId[] = ['classic', 'solarized', 'nord', 'gruvbox', 'catppuccin'];

export type SortKey = 'rate' | 'payoffDate' | 'totalInterest' | 'balanceAtFixedEnd' | 'payment' | 'monthlyOutlay';
export const SORT_KEYS: readonly SortKey[] = [
  'rate',
  'payoffDate',
  'totalInterest',
  'balanceAtFixedEnd',
  'payment',
  'monthlyOutlay',
];
export type SortDirection = 'asc' | 'desc';

export interface CsvDialect {
  delimiter: ';' | ',' | '\t';
  decimal: ',' | '.';
  thousands: '' | '.' | ',';
  dateFormat: 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  encoding: 'utf8bom' | 'utf8';
  headerLanguage: 'de' | 'en';
}

export interface CsvExportDefaults extends CsvDialect {
  preset: 'de' | 'en' | 'universal' | 'custom';
  granularity: 'monthly' | 'yearly';
  projection: 'current' | 'withoutSpecial' | 'originalPlan';
  includeParams: boolean;
}

export type OverviewFilter = 'all' | 'offer' | 'active' | 'closed';

export interface Settings {
  language: 'system' | 'de' | 'en';
  appearance: 'system' | 'light' | 'dark';
  palette: PaletteId;
  overviewSort: { key: SortKey; direction: SortDirection };
  overviewFilter: OverviewFilter;
  csvDefaults: CsvExportDefaults;
  notifications: {
    monthlyBreakdown: boolean;
    specialReminder: boolean;
    fixedRateEnd: boolean;
    newLoanDefaults: LoanNotificationPrefs;
  };
  lastBackupExportAt?: string;
  disclaimerAcceptedAt?: string;
  schemaVersion: number;
}

/* ---------- Derived types (not persisted) ---------- */

export type SpecialStatus = 'none' | 'planned' | 'confirmed' | 'unconfirmed';

export interface ScheduleRow {
  n: number;
  date: ISODate;
  opening: Money;
  payment: Money;
  interest: Money;
  regularPrincipal: Money;
  special: Money;
  closing: Money;
  phase: 'fixed' | 'followUp';
  isEstimate: boolean;
  specialSource: 'rule' | 'override' | 'none';
  specialStatus: SpecialStatus;
  isActual: boolean;
}

export interface LoanKpis {
  annuity: Money;
  initialRepaymentRate: Rate;
  /** Average per month: yearly special repayments count 1/12 (§5.10). */
  monthlyOutlay: Money;
  /** Breakdown of {@link monthlyOutlay} besides the annuity. */
  outlayParts: { monthlySpecial: Money; yearlySpecials: { month: number; amount: Money }[] };
  atFixedRateEnd: {
    date: ISODate;
    balance: Money;
    interestPaid: Money;
    regularPrincipalPaid: Money;
    specialPaid: Money;
    payments: number;
    paidOffBeforeEnd: boolean;
  };
  payoff: { date: ISODate; payments: number; totalInterest: Money; totalSpecial: Money; isEstimate: boolean };
  thisMonth?: { row: ScheduleRow; kind: 'current' | 'first' };
  unconfirmedSpecials: number;
}

export interface RankedLoan {
  loan: Loan;
  kpis: LoanKpis;
  rank: number;
}

export interface YearRow {
  year: number;
  part: 'full' | 'fixed' | 'followUp';
  payments: number;
  interest: Money;
  regularPrincipal: Money;
  special: Money;
  closing: Money;
  isEstimate: boolean;
}

export interface ValidationIssue {
  path: string;
  messageKey: string;
  params?: Record<string, string | number>;
  severity: 'error' | 'warning';
}
