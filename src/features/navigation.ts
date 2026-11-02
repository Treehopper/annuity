import { router } from 'expo-router';
import { useMemo } from 'react';

import { useAppStore } from '@/store/appStore';
import { useLayoutClass } from '@/ui/layout/layout';

/**
 * Maps panel intents to route changes (§4.12 rule 3). Compact pushes screens;
 * two-pane layouts replace the detail pane. This is the only code that changes
 * when the arrangement changes.
 */
export function useLoanNavigation() {
  const cls = useLayoutClass();
  return useMemo(() => {
    const twoPane = cls !== 'compact';
    const go = (href: string) => (twoPane ? router.replace(href as never) : router.push(href as never));
    const back = (fallback: string) => {
      if (router.canGoBack()) router.back();
      else router.replace(fallback as never);
    };
    return {
      selectLoan: (id: string) => (twoPane ? router.replace(`/loan/${id}` as never) : router.push(`/loan/${id}` as never)),
      createLoan: () => go('/loan/new'),
      editLoan: (id: string) => go(`/loan/${id}/edit`),
      openSchedule: (id: string, date?: string) => go(`/loan/${id}/schedule${date ? `?date=${date}` : ''}`),
      backToOverview: () => back('/'),
      backToLoan: (id: string) => back(`/loan/${id}`),
      /** After saving: show the loan's detail. A second loan makes the overview the root again (§6.2). */
      afterSave: (id: string, isNew: boolean) => {
        const count = useAppStore.getState().loans.length;
        if (isNew && count === 2 && !twoPane) {
          if (router.canDismiss()) router.dismissAll();
          router.replace('/' as never);
          setTimeout(() => router.push(`/loan/${id}` as never), 0);
        } else if (isNew) router.replace(`/loan/${id}` as never);
        else back(`/loan/${id}`);
      },
      /** After deleting: one loan left → its detail; otherwise the overview (§6.2). */
      afterDelete: () => {
        const loans = useAppStore.getState().loans;
        if (router.canDismiss()) router.dismissAll();
        router.replace((loans.length === 1 ? `/loan/${loans[0]!.id}` : '/') as never);
      },
      settings: (sub?: string) => go(sub ? `/settings/${sub}` : '/settings'),
      backToSettings: () => back('/settings'),
    };
  }, [cls]);
}

export type LoanNavigation = ReturnType<typeof useLoanNavigation>;
