import type { LoanParams } from '@alp/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Formatter } from '@/features/format';
import { Card, Text } from '@/ui/components';
import { AdaptiveSheet } from '@/ui/overlays';
import { space, tabular } from '@/ui/theme/tokens';

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = (n: number) => [...String(n)].map((d) => SUPERSCRIPT[Number(d)]).join('');

/** Explains how the monthly payment follows from the initial repayment rate or the term (§5.2), with the loan's numbers. */
export function RateInfoSheet({ params, annuity, f, visible, onClose }: { params: LoanParams; annuity: string; f: Formatter; visible: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const P = f.money(params.principal);
  const i = f.percent(params.nominalRate);
  const result = f.money(annuity);
  const rounding = t(params.rounding === 'bank' ? 'rateInfo.roundingBank' : 'rateInfo.roundingSpreadsheet');

  let formula: string;
  let legend: string;
  let filled: string[];
  let text: string;
  if (params.payment.mode === 'initialRepayment') {
    formula = t('rateInfo.repayment.formula');
    legend = t('rateInfo.repayment.legend');
    filled = [`${P} × (${i} + ${f.percent(params.payment.initialRepaymentRate)}) ÷ 12`, `= ${result}`];
    text = t('rateInfo.repayment.text');
  } else if (params.payment.mode === 'term') {
    const n = params.payment.termMonths;
    const q = Number(params.nominalRate) / 12; // display only; the payment itself comes from the core
    const qFmt = new Intl.NumberFormat(f.locale, { maximumFractionDigits: 4 }).format(q * 100) + (f.lang === 'de' ? ' %' : '%');
    const base = new Intl.NumberFormat(f.locale, { maximumFractionDigits: 6 }).format(1 + q);
    formula = t('rateInfo.term.formula');
    legend = t('rateInfo.term.legend');
    filled = [
      t('rateInfo.term.q', { rate: i, q: qFmt }),
      t('rateInfo.term.n', { n }),
      `${P} × ${qFmt}`,
      `÷ (1 − ${base}⁻${superscript(n)})`,
      `= ${result}`,
    ];
    text = t('rateInfo.term.text', { n });
  } else {
    return null;
  }

  return (
    <AdaptiveSheet visible={visible} title={t('rateInfo.title')} onClose={onClose} testID="rate-info">
      <View style={{ gap: space.m }}>
        <Card style={{ gap: space.xs }}>
          <Text bold>{formula}</Text>
          <Text variant="muted">{legend}</Text>
        </Card>
        <View style={{ gap: space.xs }}>
          <Text variant="section">{t('rateInfo.yourLoan')}</Text>
          {filled.map((line) => (
            <Text key={line} style={tabular} bold={line.startsWith('=')}>
              {line}
            </Text>
          ))}
        </View>
        <Text>{text}</Text>
        <Text variant="muted">{rounding}</Text>
      </View>
    </AdaptiveSheet>
  );
}
