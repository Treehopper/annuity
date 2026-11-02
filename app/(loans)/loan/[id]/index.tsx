import { Redirect, useLocalSearchParams } from 'expo-router';

import { useLoanMenu } from '@/features/loanActions';
import { useLoanNavigation } from '@/features/navigation';
import { useLoan } from '@/features/projections';
import { LoanDetailPanel } from '@/panels/LoanDetailPanel';
import { useAppStore } from '@/store/appStore';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

export default function LoanDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useLoanNavigation();
  const cls = useLayoutClass();
  const loan = useLoan(id);
  const single = useAppStore((s) => s.loans.length === 1);
  const menu = useLoanMenu(loan, nav);
  if (!loan) return <Redirect href="/" />;
  // With a single loan the detail is the root: no back arrow (§6.5).
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'} onBack={cls === 'compact' && !single ? nav.backToOverview : undefined}>
      <LoanDetailPanel loanId={loan.id} menu={menu} onOpenSchedule={nav.openSchedule} />
    </PanelHost>
  );
}
