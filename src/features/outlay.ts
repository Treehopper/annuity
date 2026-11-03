import type { LoanKpis } from '@alp/core';
import type { TFunction } from 'i18next';

import type { Formatter } from './format';

/**
 * "1.701,00 € Rate + 5.000,00 € jährlich im Dezember": what the (average) monthly outlay is
 * made of. Undefined without special repayment rules, when the outlay is just the payment.
 */
export function outlayBreakdown(kpis: Pick<LoanKpis, 'annuity' | 'outlayParts'>, f: Formatter, t: TFunction): string | undefined {
  const { monthlySpecial, yearlySpecials } = kpis.outlayParts;
  const parts = [t('detail.outlayRate', { amount: f.money(kpis.annuity) })];
  if (Number(monthlySpecial) > 0) parts.push(t('detail.outlayMonthly', { amount: f.money(monthlySpecial) }));
  for (const y of yearlySpecials) parts.push(t('detail.outlayYearly', { amount: f.money(y.amount), month: t(`months.${y.month}`) }));
  return parts.length > 1 ? parts.join(' + ') : undefined;
}

/** Special repayments for the overview card: "1.100,00 €" monthly, "5.000,00 €/Jahr" yearly. */
export function specialSummary(kpis: Pick<LoanKpis, 'outlayParts'>, f: Formatter, t: TFunction): string | undefined {
  const { monthlySpecial, yearlySpecials } = kpis.outlayParts;
  const parts: string[] = [];
  if (Number(monthlySpecial) > 0) parts.push(f.money(monthlySpecial));
  const yearly = yearlySpecials.reduce((sum, y) => sum + Number(y.amount), 0);
  if (yearly > 0) parts.push(t('overview.perYear', { amount: f.money(yearly) }));
  return parts.length ? parts.join(' + ') : undefined;
}
