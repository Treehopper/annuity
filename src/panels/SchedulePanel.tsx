import { yearMonth, type ScheduleRow, type YearRow } from '@alp/core';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useFormat, type Formatter } from '@/features/format';
import { project, useLoan, useToday, yearlyOf, type Projection } from '@/features/projections';
import { useAppStore } from '@/store/appStore';
import { Button, Chip, Divider, Segmented, Text, ValueRow } from '@/ui/components';
import { usePanelChrome } from '@/ui/layout/chrome';
import { usePaneWidth } from '@/ui/layout/layout';
import { AdaptiveSheet } from '@/ui/overlays';
import { useTheme } from '@/ui/theme/useTheme';
import { space, tabular } from '@/ui/theme/tokens';

export type Granularity = 'monthly' | 'yearly';

export interface SchedulePanelProps {
  loanId: string;
  granularity: Granularity;
  projection: Projection;
  /** Jump target (ISO date), e.g. from a notification deep link. */
  date?: string;
  onChangeView(view: { granularity?: Granularity; projection?: Projection }): void;
}

type Item =
  | { type: 'row'; row: ScheduleRow }
  | { type: 'year'; row: YearRow }
  | { type: 'divider'; label: string; paidOffBefore?: boolean };

/** Amortization schedule (§6.6). Two-line rows below 560 px pane width, full table above. */
export function SchedulePanel({ loanId, granularity, projection, date, onChangeView }: SchedulePanelProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const { c } = useTheme();
  const width = usePaneWidth();
  const today = useToday();
  const loan = useLoan(loanId);
  const listRef = useRef<FlashListRef<Item>>(null);
  const [detail, setDetail] = useState<ScheduleRow | undefined>();
  const wide = width >= 560;

  const effectiveProjection: Projection = projection === 'originalPlan' && !loan?.baseline ? 'current' : projection;
  const data = useMemo(() => {
    if (!loan) return undefined;
    const p = project(loan, effectiveProjection, today);
    const params = effectiveProjection === 'originalPlan' && loan.baseline ? loan.baseline.params : loan.params;
    const Nfix = params.fixedRateMonths;
    const fixedEnd = p.kpis.atFixedRateEnd;
    const items: Item[] = [];
    if (granularity === 'monthly') {
      p.schedule.forEach((row) => {
        items.push({ type: 'row', row });
        if (row.n === Nfix && p.schedule.length > Nfix) items.push({ type: 'divider', label: t('schedule.fixedEnd', { date: f.monthYear(fixedEnd.date) }) });
      });
    } else {
      const years = yearlyOf(loan, effectiveProjection, today);
      years.forEach((row, i) => {
        items.push({ type: 'year', row });
        if (row.part === 'fixed' && years[i + 1]?.part === 'followUp') items.push({ type: 'divider', label: t('schedule.fixedEnd', { date: f.monthYear(fixedEnd.date) }) });
      });
    }
    if (fixedEnd.paidOffBeforeEnd) items.push({ type: 'divider', label: t('schedule.fixedEnd', { date: f.monthYear(fixedEnd.date) }), paidOffBefore: true });
    return { items, kpis: p.kpis };
  }, [loan, effectiveProjection, today, granularity, t, f]);

  const indexOf = (target: 'today' | 'fixedEnd' | 'payoff' | string): number => {
    if (!data) return -1;
    const { items } = data;
    if (target === 'payoff') return Math.max(0, items.findLastIndex((i) => i.type !== 'divider'));
    if (target === 'fixedEnd') {
      const d = items.findIndex((i) => i.type === 'divider');
      return d >= 0 ? d : items.length - 1;
    }
    const iso = target === 'today' ? today : target;
    if (granularity === 'yearly') return items.findIndex((i) => i.type === 'year' && String(i.row.year) === iso.slice(0, 4));
    return items.findIndex((i) => i.type === 'row' && yearMonth(i.row.date) === yearMonth(iso));
  };

  const jump = (target: Parameters<typeof indexOf>[0]) => {
    const idx = indexOf(target);
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
  };

  // Initial jump target from the URL.
  useEffect(() => {
    if (!date || !data) return;
    const idx = indexOf(date);
    if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.3 }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, granularity, !!data]);

  usePanelChrome({ title: t('schedule.title'), badge: loan ? { status: loan.status, label: t(`status.${loan.status}`) } : undefined }, [t, loan?.status]);

  if (!loan || !data) return <Text style={{ padding: space.l }}>{t('err.loan.notFound')}</Text>;
  const running = loan.status !== 'offer';
  const projections: Projection[] = loan.baseline ? ['current', 'withoutSpecial', 'originalPlan'] : ['current', 'withoutSpecial'];

  return (
    <View style={{ flex: 1 }} testID="schedule">
      <View style={{ padding: space.l, paddingBottom: space.s, gap: space.s, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Segmented
          testID="granularity"
          value={granularity}
          onChange={(g) => onChangeView({ granularity: g })}
          options={[
            { value: 'monthly', label: t('schedule.monthly') },
            { value: 'yearly', label: t('schedule.yearly') },
          ]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, alignItems: 'center' }}>
          <Text variant="muted">{t('schedule.projection')}:</Text>
          {projections.map((p) => (
            <Chip key={p} label={t(`schedule.projections.${p}`)} selected={effectiveProjection === p} onPress={() => onChangeView({ projection: p })} testID={`projection-${p}`} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' }}>
          <Text variant="muted">{t('schedule.jump')}:</Text>
          {running ? <Button compact kind="ghost" label={t('schedule.jumpToday')} onPress={() => jump('today')} testID="jump-today" /> : null}
          <Button compact kind="ghost" label={t('schedule.jumpFixedEnd')} onPress={() => jump('fixedEnd')} testID="jump-fixed" />
          <Button compact kind="ghost" label={t('schedule.jumpPayoff')} onPress={() => jump('payoff')} testID="jump-payoff" />
        </View>
        <HeaderRow wide={wide} yearly={granularity === 'yearly'} />
      </View>
      <FlashList
        ref={listRef}
        data={data.items}
        keyExtractor={(item, i) => (item.type === 'row' ? `m${item.row.n}` : item.type === 'year' ? `y${item.row.year}${item.row.part}` : `d${i}`)}
        getItemType={(item) => item.type}
        renderItem={({ item }) =>
          item.type === 'row' ? (
            <MonthRow row={item.row} wide={wide} f={f} today={today} running={running} onPress={() => setDetail(item.row)} />
          ) : item.type === 'year' ? (
            <YearRowView row={item.row} wide={wide} f={f} />
          ) : (
            <DividerRow label={item.label} paidOffBefore={item.paidOffBefore} />
          )
        }
        ListFooterComponent={
          <Text variant="small" style={{ padding: space.l }}>
            {t('schedule.legend')}
          </Text>
        }
      />
      <RowDetailSheet row={detail} loanId={loan.id} canConfirm={loan.status === 'active' && effectiveProjection === 'current'} onClose={() => setDetail(undefined)} />
    </View>
  );
}

function statusMark(row: ScheduleRow): string {
  if (row.specialStatus === 'confirmed') return '✓';
  if (row.specialStatus === 'unconfirmed') return '○';
  if (row.specialSource === 'override') return '✎';
  return '';
}

const COLS_WIDE = { n: 40, date: 80, money: 1 } as const;

function HeaderRow({ wide, yearly }: { wide: boolean; yearly: boolean }) {
  const { t } = useTranslation();
  const cell = (label: string, flex = 1, align: 'left' | 'right' = 'right') => (
    <Text variant="small" bold style={{ flex, textAlign: align }} numberOfLines={1}>
      {label}
    </Text>
  );
  if (yearly)
    return (
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {cell(t('schedule.cols.year'), 0.8, 'left')}
        {wide ? cell(t('schedule.cols.payments'), 0.6) : null}
        {cell(t('schedule.cols.interest'))}
        {cell(t('schedule.cols.principal'))}
        {cell(t('schedule.cols.special'))}
        {cell(t('schedule.cols.closing'), 1.3)}
      </View>
    );
  if (wide)
    return (
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Text variant="small" bold style={{ width: COLS_WIDE.n }}>
          {t('schedule.cols.n')}
        </Text>
        <Text variant="small" bold style={{ width: COLS_WIDE.date }}>
          {t('schedule.cols.date')}
        </Text>
        {cell(t('schedule.cols.opening'), 1.3)}
        {cell(t('schedule.cols.payment'))}
        {cell(t('schedule.cols.interest'))}
        {cell(t('schedule.cols.principal'))}
        {cell(t('schedule.cols.special'))}
        {cell(t('schedule.cols.closing'), 1.3)}
        <View style={{ width: 18 }} />
      </View>
    );
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {cell(`${t('schedule.cols.n')}  ${t('schedule.cols.date')}`, 1.2, 'left')}
        {cell(t('schedule.cols.interest'))}
        {cell(t('schedule.cols.principal'))}
        {cell(t('schedule.cols.special'))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {cell('', 1.2, 'left')}
        {cell(t('schedule.cols.payment'), 1.2)}
        {cell(t('schedule.cols.closing'), 1.8)}
      </View>
    </View>
  );
}

function MonthRow({ row, wide, f, today, running, onPress }: { row: ScheduleRow; wide: boolean; f: Formatter; today: string; running: boolean; onPress(): void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const isToday = running && yearMonth(row.date) === yearMonth(today);
  const mark = statusMark(row);
  const it = row.isEstimate;
  const num = (v: string, flex = 1, bold = false) => (
    <Text variant="amount" italic={it} bold={bold} style={{ flex, fontSize: 14 }} numberOfLines={1}>
      {f.amount(v)}
    </Text>
  );
  const est = it ? '*' : '';
  const bg = isToday ? c.surfaceAlt : 'transparent';
  const markColor = row.specialStatus === 'confirmed' ? c.positive : row.specialStatus === 'unconfirmed' ? c.warning : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('schedule.rowTitle', { n: row.n, date: f.date(row.date) })}, ${t('schedule.cols.closing')} ${f.money(row.closing)}`}
      onPress={onPress}
      testID={`row-${row.date}`}
      style={({ pressed }) => ({
        paddingHorizontal: space.l,
        paddingVertical: space.s,
        backgroundColor: pressed ? c.surfaceAlt : bg,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        borderLeftWidth: isToday ? 3 : 0,
        borderLeftColor: c.primary,
      })}>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
          <Text variant="muted" style={{ width: COLS_WIDE.n, ...tabular }}>
            {row.n}
          </Text>
          <Text italic={it} style={{ width: COLS_WIDE.date, fontSize: 14, ...tabular }}>
            {f.monthYear(row.date) + est}
          </Text>
          {num(row.opening, 1.3)}
          {num(row.payment)}
          {num(row.interest)}
          {num(row.regularPrincipal)}
          {num(row.special)}
          {num(row.closing, 1.3, true)}
          <Text style={{ width: 18, color: markColor, textAlign: 'center' }}>{mark}</Text>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
            <Text italic={it} style={{ flex: 1.2, fontSize: 14, ...tabular }} numberOfLines={1}>
              <Text variant="muted" style={{ fontSize: 14 }}>
                {String(row.n).padStart(3, ' ')}{' '}
              </Text>
              {f.monthYear(row.date) + est}
            </Text>
            {num(row.interest)}
            {num(row.regularPrincipal)}
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
              <Text variant="amount" italic={it} style={{ fontSize: 14 }}>
                {f.integer(Number(row.special))}
              </Text>
              <Text style={{ color: markColor, width: 14, textAlign: 'center' }}>{mark}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Text variant="small" color="primary" style={{ flex: 1.2 }}>
              {isToday ? `▶ ${t('schedule.today')}` : ''}
            </Text>
            {num(row.payment, 1.2)}
            {num(row.closing, 1.8, true)}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function YearRowView({ row, wide, f }: { row: YearRow; wide: boolean; f: Formatter }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const it = row.isEstimate;
  const num = (v: string, flex = 1, bold = false) => (
    <Text variant="amount" italic={it} bold={bold} style={{ flex, fontSize: 14 }} numberOfLines={1}>
      {wide ? f.amount(v) : f.integer(Number(v))}
    </Text>
  );
  return (
    <View
      testID={`year-${row.year}-${row.part}`}
      style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.m, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: 'center' }}>
      <View style={{ flex: 0.8 }}>
        <Text italic={it} bold style={tabular}>
          {row.year}
          {it ? '*' : ''}
        </Text>
        {row.part !== 'full' ? <Text variant="small">{t(`schedule.phases.${row.part}`)}</Text> : null}
      </View>
      {wide ? (
        <Text variant="amount" style={{ flex: 0.6, fontSize: 14 }}>
          {row.payments}
        </Text>
      ) : null}
      {num(row.interest)}
      {num(row.regularPrincipal)}
      {num(row.special)}
      {num(row.closing, 1.3, true)}
    </View>
  );
}

function DividerRow({ label, paidOffBefore }: { label: string; paidOffBefore?: boolean }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  return (
    <View testID="fixed-end-divider" style={{ paddingHorizontal: space.l, paddingVertical: space.m, backgroundColor: c.surfaceAlt, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.primary, gap: space.xs }}>
      <Text variant="section" color="primary" style={{ textAlign: 'center' }}>
        {label}
      </Text>
      {paidOffBefore ? (
        <Text color="positive" style={{ textAlign: 'center' }}>
          {t('schedule.paidOffBeforeEnd')} ✓
        </Text>
      ) : null}
    </View>
  );
}

function RowDetailSheet({ row, loanId, canConfirm, onClose }: { row?: ScheduleRow; loanId: string; canConfirm: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const confirmable = canConfirm && (row.specialStatus === 'unconfirmed' || row.specialStatus === 'planned') && Number(row.special) > 0;
  return (
    <AdaptiveSheet
      visible
      title={t('schedule.rowTitle', { n: row.n, date: f.date(row.date) })}
      onClose={onClose}
      testID="row-detail"
      footer={
        confirmable ? (
          <Button
            label={t('schedule.confirmAsPlanned')}
            icon="checkmark"
            loading={busy}
            testID="confirm-as-planned"
            onPress={async () => {
              setBusy(true);
              await useAppStore.getState().confirmAsPlanned(loanId, row.date);
              setBusy(false);
              onClose();
            }}
          />
        ) : undefined
      }>
      <ValueRow label={t('schedule.cols.opening')} value={f.money(row.opening)} />
      <ValueRow label={t('schedule.cols.payment')} value={f.money(row.payment)} emphasis />
      <ValueRow label={`├ ${t('schedule.cols.interest')}`} value={f.money(row.interest)} indent />
      <ValueRow label={`└ ${t('schedule.cols.principal')}`} value={f.money(row.regularPrincipal)} indent />
      <ValueRow label={t('detail.special')} value={f.money(row.special)} />
      <ValueRow label={t('schedule.cols.closing')} value={f.money(row.closing)} emphasis />
      <Divider />
      <ValueRow label={t('schedule.status')} value={t(`schedule.statuses.${row.specialStatus}`)} />
      <ValueRow label={t('schedule.phase')} value={t(`schedule.phases.${row.phase}`)} italic={row.isEstimate} />
      <ValueRow label={t('schedule.actual')} value={t(row.isActual ? 'common.yes' : 'common.no')} />
    </AdaptiveSheet>
  );
}
