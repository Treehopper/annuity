import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { useLoanNavigation } from '@/features/navigation';
import { useLoan, type Projection } from '@/features/projections';
import { SchedulePanel, type Granularity } from '@/panels/SchedulePanel';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

/** View options live in the URL so they survive layout switches (§4.12 rule 4). */
export default function ScheduleRoute() {
  const { id, date, view, projection } = useLocalSearchParams<{ id: string; date?: string; view?: string; projection?: string }>();
  const nav = useLoanNavigation();
  const cls = useLayoutClass();
  const loan = useLoan(id);
  if (!loan) return <Redirect href="/" />;
  const granularity: Granularity = view === 'yearly' ? 'yearly' : 'monthly';
  const proj: Projection = projection === 'withoutSpecial' || projection === 'originalPlan' ? projection : 'current';
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'} onBack={() => nav.backToLoan(loan.id)}>
      <SchedulePanel
        loanId={loan.id}
        granularity={granularity}
        projection={proj}
        date={date}
        onChangeView={(v) => router.setParams({ ...(v.granularity ? { view: v.granularity } : {}), ...(v.projection ? { projection: v.projection } : {}) })}
      />
    </PanelHost>
  );
}
