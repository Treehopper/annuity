import { monthsBetween, type LoanKpis } from '@alp/core';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useFormat, type Formatter } from '@/features/format';
import { outlayBreakdown as describeOutlay } from '@/features/outlay';
import { useLoan, useProjection, useToday } from '@/features/projections';
import { useAppStore } from '@/store/appStore';
import { Banner, Button, Card, Icon, SectionTitle, Text, ValueRow } from '@/ui/components';
import { BalanceChart, type ChartSeries } from '@/ui/chart/BalanceChart';
import { usePanelChrome, type PanelAction } from '@/ui/layout/chrome';
import { usePaneWidth } from '@/ui/layout/layout';
import { askConfirm } from '@/ui/overlays';
import { useTheme } from '@/ui/theme/useTheme';
import { radius, space } from '@/ui/theme/tokens';

export interface LoanDetailPanelProps {
  loanId: string;
  menu: PanelAction[];
  onOpenSchedule(id: string, date?: string): void;
}

/** Loan detail dashboard (§6.5). */
export function LoanDetailPanel({ loanId, menu, onOpenSchedule }: LoanDetailPanelProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const { c } = useTheme();
  const width = usePaneWidth();
  const today = useToday();
  const loan = useLoan(loanId);
  const current = useProjection(loan, 'current');
  const plan = useProjection(loan?.baseline ? loan : undefined, 'originalPlan');
  const without = useProjection(loan && loan.status === 'offer' ? loan : undefined, 'withoutSpecial');

  usePanelChrome(
    { title: loan?.name ?? '', badge: loan ? { status: loan.status, label: t(`status.${loan.status}`) } : undefined, actions: menu },
    [loan?.name, loan?.status, menu, t],
  );

  if (!loan || !current) return <Text style={{ padding: space.l }}>{t('err.loan.notFound')}</Text>;
  const k = current.kpis;
  const outlayBreakdown = describeOutlay(k, f, t);
  const running = loan.status !== 'offer';
  const paidOff = k.payoff.date < today && k.payoff.payments > 0;
  const twoCol = width >= 720;

  const series: ChartSeries[] = [
    { name: t('schedule.projections.current'), color: 'chart1', opening: Number(loan.params.principal), points: toPoints(current.schedule) },
  ];
  if (plan) series.push({ name: t('schedule.projections.originalPlan'), color: 'chart2', opening: Number(loan.baseline!.params.principal), points: toPoints(plan.schedule) });
  if (without) series.push({ name: t('schedule.projections.withoutSpecial'), color: 'chart2', opening: Number(loan.params.principal), points: toPoints(without.schedule) });

  const cards = [
    <FixedEndCard key="fixed" kpis={k} f={f} />,
    <PayoffCard key="payoff" kpis={k} f={f} rate={loan.followUp.rate} />,
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xxl, maxWidth: 960, width: '100%', alignSelf: 'center' }} testID="loan-detail">
      {loan.status === 'active' && k.unconfirmedSpecials > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => onOpenSchedule(loan.id, today)} testID="unconfirmed-chip">
          <Banner icon="warning-outline" tone="warning" text={`${t('detail.toConfirm', { count: k.unconfirmedSpecials })} ›`} />
        </Pressable>
      ) : null}
      {loan.status === 'active' && paidOff ? (
        <Banner
          tone="positive"
          icon="checkmark-circle-outline"
          text={t('detail.paidOffBanner', { date: f.date(k.payoff.date) })}
          action={
            <Button
              compact
              kind="secondary"
              label={t('detail.markClosed')}
              onPress={async () => {
                const ok = await askConfirm({ title: t('lifecycle.closeTitle'), text: t('lifecycle.closeText'), confirmLabel: t('common.confirm'), cancelLabel: t('common.cancel') });
                if (ok) await useAppStore.getState().lifecycle(loan.id, 'close');
              }}
            />
          }
        />
      ) : null}

      {loan.status === 'active' ? k.thisMonth ? <ThisMonthCard kpis={k} f={f} /> : <Text variant="heading">{t('detail.paidOff', { date: f.monthYear(k.payoff.date) })}</Text> : null}

      <View style={{ flexDirection: twoCol ? 'row' : 'column', gap: space.m }}>
        {cards.map((card, i) => (
          <View key={i} style={{ flex: twoCol ? 1 : undefined }}>
            {card}
          </View>
        ))}
      </View>

      {running && plan ? <PlanDelta current={k} plan={plan.kpis} f={f} /> : null}

      <SectionTitle>{t('detail.keyFigures')}</SectionTitle>
      <Card>
        <ValueRow label={t('detail.annuity')} value={f.money(k.annuity)} emphasis />
        <ValueRow label={t('detail.outlay')} value={f.money(k.monthlyOutlay)} />
        {outlayBreakdown ? (
          <Text variant="small" style={{ textAlign: 'right', marginTop: -space.xs }} testID="outlay-breakdown">
            {outlayBreakdown}
          </Text>
        ) : null}
        <ValueRow label={t('detail.equivRepayment')} value={f.percent(k.initialRepaymentRate)} />
        <ValueRow label={t('edit.rate')} value={f.percent(loan.params.nominalRate)} />
        <ValueRow label={t('edit.principal')} value={f.money(loan.params.principal)} />
      </Card>

      <SectionTitle>{t('detail.balanceChart')}</SectionTitle>
      <Card>
        <BalanceChart
          series={series}
          width={Math.min(width, 960) - space.l * 2 - space.l * 2 - 2}
          fixedEnd={{ date: k.atFixedRateEnd.date, label: f.monthYear(k.atFixedRateEnd.date) }}
          today={running ? { date: today, label: t('schedule.today') } : undefined}
          formatMoney={f.moneyRound}
          formatDate={f.monthYear}
          estimateLabel={t('common.estimate')}
          accessibilityLabel={`${t('detail.balanceChart')}: ${f.money(loan.params.principal)} → ${f.monthYear(k.payoff.date)}`}
        />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        <Button label={t('detail.schedule')} icon="list" onPress={() => onOpenSchedule(loan.id)} testID="open-schedule" style={{ flexGrow: 1 }} />
      </View>
      {k.payoff.isEstimate ? (
        <Text variant="small" italic>
          {t('detail.estimateNote', { rate: f.percent(loan.followUp.rate) })}
        </Text>
      ) : null}
      <View style={{ height: 1, backgroundColor: c.border, marginTop: space.l, borderRadius: radius.s }} />
    </ScrollView>
  );
}

function toPoints(schedule: { date: string; closing: string; isEstimate: boolean }[]) {
  return schedule.map((r) => ({ date: r.date, balance: Number(r.closing), estimate: r.isEstimate }));
}

function ThisMonthCard({ kpis, f }: { kpis: LoanKpis; f: Formatter }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const tm = kpis.thisMonth!;
  const r = tm.row;
  const copy = async () => {
    const text = [
      `${t('detail.payment')}: ${f.money(r.payment)}`,
      `${t('detail.interest')}: ${f.money(r.interest)}`,
      `${t('detail.principal')}: ${f.money(r.regularPrincipal)}`,
      `${t('detail.special')}: ${f.money(r.special)}`,
      `${t('detail.balanceAfter')}: ${f.money(r.closing)}`,
    ].join('\n');
    await Clipboard.setStringAsync(`${f.date(r.date)}\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View testID="this-month">
      <SectionTitle>{t(tm.kind === 'first' ? 'detail.firstPayment' : 'detail.thisMonth', { date: f.date(r.date) })}</SectionTitle>
      <Card>
        <ValueRow label={t('detail.payment')} value={f.money(r.payment)} emphasis />
        <ValueRow label={`├ ${t('detail.interest')}`} value={f.money(r.interest)} indent />
        <ValueRow label={`└ ${t('detail.principal')}`} value={f.money(r.regularPrincipal)} indent />
        <ValueRow label={t('detail.special')} value={f.money(r.special)} />
        <ValueRow label={t('detail.balanceAfter')} value={f.money(r.closing)} emphasis />
        <View style={{ alignItems: 'flex-end' }}>
          <Button compact kind="ghost" icon={copied ? 'checkmark' : 'copy-outline'} label={copied ? t('common.copied') : t('common.copy')} onPress={copy} testID="copy-month" />
        </View>
      </Card>
    </View>
  );
}

function FixedEndCard({ kpis, f }: { kpis: LoanKpis; f: Formatter }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const fe = kpis.atFixedRateEnd;
  return (
    <View testID="fixed-end">
      <SectionTitle>{t('detail.fixedEnd', { date: f.monthYear(fe.date) })}</SectionTitle>
      <Card>
        <ValueRow
          label={t('detail.remaining')}
          value={f.money(fe.balance)}
          emphasis
          color={fe.paidOffBeforeEnd ? 'positive' : 'text'}
          icon={fe.paidOffBeforeEnd ? <Icon name="checkmark-circle" color={c.positive} /> : undefined}
        />
        {fe.paidOffBeforeEnd ? (
          <Text color="positive">{t('detail.paidOffBefore', { date: f.monthYear(kpis.payoff.date) })}</Text>
        ) : null}
        <ValueRow label={t('detail.interestPaid')} value={f.money(fe.interestPaid)} />
        <ValueRow label={t('detail.principalPaid')} value={f.money(fe.regularPrincipalPaid)} />
        <ValueRow label={t('detail.specialPaid')} value={f.money(fe.specialPaid)} />
        <ValueRow label={t('detail.paymentsMade')} value={f.integer(fe.payments)} />
      </Card>
    </View>
  );
}

function PayoffCard({ kpis, f, rate }: { kpis: LoanKpis; f: Formatter; rate: string }) {
  const { t } = useTranslation();
  const p = kpis.payoff;
  const est = p.isEstimate ? '*' : '';
  return (
    <View testID="payoff">
      <SectionTitle>{t('detail.payoff')}</SectionTitle>
      <Card accessibilityHint={p.isEstimate ? t('detail.estimateNote', { rate: f.percent(rate) }) : undefined}>
        <ValueRow label={t('detail.payoffDate')} value={f.monthYear(p.date) + est} emphasis italic={p.isEstimate} color={p.isEstimate ? 'warning' : 'text'} />
        <ValueRow label={t('detail.payments')} value={f.integer(p.payments) + est} italic={p.isEstimate} />
        <ValueRow label={t('detail.totalInterest')} value={f.money(p.totalInterest) + est} italic={p.isEstimate} />
        <ValueRow label={t('detail.totalSpecial')} value={f.money(p.totalSpecial) + est} italic={p.isEstimate} />
      </Card>
    </View>
  );
}

function PlanDelta({ current, plan, f }: { current: LoanKpis; plan: LoanKpis; f: Formatter }) {
  const { t } = useTranslation();
  const months = monthsBetween(plan.payoff.date, current.payoff.date);
  const interest = Number(current.payoff.totalInterest) - Number(plan.payoff.totalInterest);
  const balance = Number(current.atFixedRateEnd.balance) - Number(plan.atFixedRateEnd.balance);
  const tone = (v: number) => (v < -0.004 ? 'positive' : v > 0.004 ? 'warning' : 'text');
  const { years, months: mo } = f.yearsMonths(months);
  const monthsText = months === 0 ? '±0' : `${months > 0 ? '+' : '−'}${years ? `${years} ${t('common.years')} ` : ''}${t('common.months', { count: mo })}`;
  return (
    <View testID="vs-plan">
      <SectionTitle>{t('detail.vsPlan')}</SectionTitle>
      <Card>
        <ValueRow label={t('detail.deltaPayoff')} value={`${f.monthYear(plan.payoff.date)} → ${f.monthYear(current.payoff.date)}  ${monthsText}`} color={tone(months)} />
        <ValueRow label={t('detail.deltaBalance')} value={f.moneyDelta(balance)} color={tone(balance)} />
        <ValueRow label={t('detail.deltaInterest')} value={f.moneyDelta(interest)} color={tone(interest)} />
      </Card>
    </View>
  );
}
