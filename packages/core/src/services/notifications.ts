/** Notification planning (§4.8). Implemented in milestone M5; the type is part of the port contract. */
export interface PlannedNotification {
  id: string;
  loanId: string;
  kind: 'monthlyBreakdown' | 'specialReminder' | 'fixedRateEnd';
  /** Local date-time without time zone, e.g. '2026-10-01T08:00'. */
  fireAt: string;
  messageKey: string;
  params: Record<string, string | number>;
  deepLink: string;
}
