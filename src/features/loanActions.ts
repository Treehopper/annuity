import type { Loan } from '@alp/core';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/appStore';
import type { PanelAction } from '@/ui/layout/chrome';
import { askConfirm } from '@/ui/overlays';

import type { LoanNavigation } from './navigation';

/** ⋮ menu of the loan detail (§6.5), by status (§5.11). */
export function useLoanMenu(loan: Loan | undefined, nav: LoanNavigation): PanelAction[] {
  const { t } = useTranslation();
  const store = useAppStore.getState();
  if (!loan) return [];

  const confirmThen = async (key: string, run: () => Promise<unknown>, destructive = false) => {
    const ok = await askConfirm({
      title: t(`lifecycle.${key}Title`, { name: loan.name }),
      text: t(`lifecycle.${key}Text`),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
      destructive,
    });
    if (ok) await run();
  };

  const actions: PanelAction[] = [
    { key: 'newLoan', label: t('menu.newLoan'), onPress: () => nav.createLoan() },
    { key: 'edit', label: t('menu.edit'), onPress: () => nav.editLoan(loan.id) },
    {
      key: 'duplicate',
      label: t('menu.duplicate'),
      onPress: async () => {
        const res = await store.duplicateLoan(loan.id);
        if (res.ok) nav.afterSave(res.value.id, true);
      },
    },
  ];
  if (loan.status === 'offer')
    actions.push({ key: 'activate', label: t('menu.activate'), onPress: () => confirmThen('activate', () => store.lifecycle(loan.id, 'activate')) });
  if (loan.status === 'active') {
    actions.push(
      { key: 'revert', label: t('menu.revert'), onPress: () => confirmThen('revert', () => store.lifecycle(loan.id, 'revertToOffer')) },
      { key: 'close', label: t('menu.close'), onPress: () => confirmThen('close', () => store.lifecycle(loan.id, 'close')) },
      { key: 'rebaseline', label: t('menu.rebaseline'), onPress: () => confirmThen('rebaseline', () => store.lifecycle(loan.id, 'rebaseline')) },
    );
  }
  if (loan.status === 'closed')
    actions.push({ key: 'reopen', label: t('menu.reopen'), onPress: () => confirmThen('reopen', () => store.lifecycle(loan.id, 'reopen')) });
  actions.push({
    key: 'delete',
    label: t('menu.delete'),
    destructive: true,
    onPress: () =>
      confirmThen(
        'delete',
        async () => {
          await store.deleteLoan(loan.id);
          nav.afterDelete();
        },
        true,
      ),
  });
  return actions;
}
