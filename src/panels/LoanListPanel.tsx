import { SORT_KEYS, type OverviewFilter, type RankedLoan, type SortKey } from '@alp/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { useFormat } from '@/features/format';
import { specialSummary } from '@/features/outlay';
import { useOverview } from '@/features/projections';
import { useAppStore } from '@/store/appStore';
import { Button, Card, Chip, IconButton, StatusBadge, Text } from '@/ui/components';
import { usePanelChrome } from '@/ui/layout/chrome';
import { AdaptiveSheet, askConfirm, Menu } from '@/ui/overlays';
import { useTheme } from '@/ui/theme/useTheme';
import { radius, space } from '@/ui/theme/tokens';

const FILTERS: OverviewFilter[] = ['all', 'offer', 'active', 'closed'];

export interface LoanListPanelProps {
  selectedId?: string;
  onSelectLoan(id: string): void;
  onCreateLoan(): void;
  onDuplicated?(id: string): void;
  onDeleted?(): void;
}

/** Overview (§6.2). */
export function LoanListPanel({ selectedId, onSelectLoan, onCreateLoan, onDuplicated, onDeleted }: LoanListPanelProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const items = useOverview();
  const total = useAppStore((s) => s.loans.length);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [sortOpen, setSortOpen] = useState(false);
  const sort = settings?.overviewSort ?? { key: 'payoffDate' as SortKey, direction: 'asc' as const };
  const filter = settings?.overviewFilter ?? 'all';

  usePanelChrome(
    { title: t('overview.title'), actions: [{ key: 'new', label: t('overview.new'), icon: 'add', primary: true, onPress: onCreateLoan, testID: 'new-loan' }] },
    [t, onCreateLoan],
  );

  if (total === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.l }} testID="empty-state">
        <Text variant="display" color="primary" accessibilityElementsHidden>
          ¤
        </Text>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {t('overview.emptyTitle')}
        </Text>
        <Text variant="muted" style={{ textAlign: 'center', maxWidth: 360 }}>
          {t('overview.emptyText')}
        </Text>
        <Button label={t('overview.create')} icon="add" onPress={onCreateLoan} testID="create-first-loan" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.m, gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSortOpen(true)}
            testID="sort-button"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs }}>
            <Text variant="muted">{t('overview.sort')}:</Text>
            <Text color="primary" bold numberOfLines={1} style={{ flexShrink: 1 }}>
              {t(`overview.sortKeys.${sort.key}`)} ▾
            </Text>
          </Pressable>
          <IconButton
            icon={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
            label={`${t('overview.toggleDirection')} (${t(sort.direction === 'asc' ? 'overview.ascending' : 'overview.descending')})`}
            onPress={() => updateSettings({ overviewSort: { ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' } })}
            testID="sort-direction"
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityLabel={t('overview.filter')}>
          {FILTERS.map((f) => (
            <Chip key={f} label={t(`overview.filters.${f}`)} selected={filter === f} onPress={() => updateSettings({ overviewFilter: f })} testID={`filter-${f}`} />
          ))}
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.loan.id}
        contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xxl }}
        ListEmptyComponent={<Text variant="muted">{t('overview.noneForFilter')}</Text>}
        renderItem={({ item }) => (
          <LoanCard
            item={item}
            sortKey={sort.key}
            selected={item.loan.id === selectedId}
            onPress={() => onSelectLoan(item.loan.id)}
            onDuplicate={async () => {
              const res = await useAppStore.getState().duplicateLoan(item.loan.id);
              if (res.ok) onDuplicated?.(res.value.id);
            }}
            onDelete={async () => {
              const ok = await askConfirm({
                title: t('lifecycle.deleteTitle', { name: item.loan.name }),
                text: t('lifecycle.deleteText'),
                confirmLabel: t('common.delete'),
                cancelLabel: t('common.cancel'),
                destructive: true,
              });
              if (ok) {
                await useAppStore.getState().deleteLoan(item.loan.id);
                onDeleted?.();
              }
            }}
          />
        )}
      />
      <AdaptiveSheet visible={sortOpen} title={t('overview.sort')} onClose={() => setSortOpen(false)} testID="sort-sheet">
        {SORT_KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: k === sort.key }}
            testID={`sort-${k}`}
            onPress={() => {
              void updateSettings({ overviewSort: { ...sort, key: k } });
              setSortOpen(false);
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m, borderRadius: radius.m, backgroundColor: k === sort.key ? c.surfaceAlt : 'transparent' }}>
            <Text bold={k === sort.key} color={k === sort.key ? 'primary' : 'text'}>
              {t(`overview.sortKeys.${k}`)}
            </Text>
          </Pressable>
        ))}
      </AdaptiveSheet>
    </View>
  );
}

function LoanCard({
  item,
  sortKey,
  selected,
  onPress,
  onDuplicate,
  onDelete,
}: {
  item: RankedLoan;
  sortKey: SortKey;
  selected: boolean;
  onPress(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const { c } = useTheme();
  const { loan, kpis } = item;
  const special = specialSummary(kpis, f, t);
  const fe = kpis.atFixedRateEnd;
  const em = (k: SortKey) => sortKey === k;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={`loan-card-${loan.name}`} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={selected ? { borderColor: c.primary, borderWidth: 2 } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: -space.s }}>
          <StatusBadge status={loan.status} label={t(`status.${loan.status}`)} />
          <Menu
            label={t('common.more')}
            icon="ellipsis-horizontal"
            testID={`card-menu-${loan.name}`}
            actions={[
              { key: 'duplicate', label: t('overview.duplicate'), onPress: onDuplicate },
              { key: 'delete', label: t('common.delete'), onPress: onDelete, destructive: true },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
          <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {loan.name}
          </Text>
          <Text variant="amount" bold={em('rate')}>
            {f.percent(loan.params.nominalRate)}
          </Text>
        </View>
        <Text bold={em('payment') || em('monthlyOutlay')} style={{ fontVariant: ['tabular-nums'] }}>
          {special
            ? t('overview.paymentPlusSpecial', { amount: f.money(kpis.annuity), special })
            : t('overview.payment', { amount: f.money(kpis.annuity) })}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
          <Text variant="muted">{t('overview.fixedEnd', { date: f.monthYear(fe.date) })}</Text>
          <Text variant="amount" bold={em('balanceAtFixedEnd')} color={fe.paidOffBeforeEnd ? 'positive' : 'text'}>
            {f.moneyRound(fe.balance)}
            {fe.paidOffBeforeEnd ? ' ✓' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
          <Text variant="muted" bold={em('payoffDate')} italic={kpis.payoff.isEstimate}>
            {t(kpis.payoff.isEstimate ? 'overview.paidOffEst' : 'overview.paidOff', { date: f.monthYear(kpis.payoff.date) })}
          </Text>
          <Text variant="muted">{t('common.months', { count: kpis.payoff.payments })}</Text>
        </View>
        {em('totalInterest') ? (
          <Text bold italic={kpis.payoff.isEstimate}>
            {t('overview.totalInterest', { amount: f.money(kpis.payoff.totalInterest) })}
            {kpis.payoff.isEstimate ? '*' : ''}
          </Text>
        ) : null}
        {em('monthlyOutlay') ? <Text variant="muted">{t('overview.outlay', { amount: f.money(kpis.monthlyOutlay) })}</Text> : null}
      </Card>
    </Pressable>
  );
}
