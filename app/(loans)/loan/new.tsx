import { useLoanNavigation } from '@/features/navigation';
import { LoanEditPanel } from '@/panels/LoanEditPanel';
import { useAppStore } from '@/store/appStore';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

export default function NewLoanRoute() {
  const nav = useLoanNavigation();
  const cls = useLayoutClass();
  const count = useAppStore((s) => s.loans.length);
  const back = () => (count === 1 ? nav.backToLoan(useAppStore.getState().loans[0]!.id) : nav.backToOverview());
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'}>
      <LoanEditPanel onSaved={nav.afterSave} onCancel={back} />
    </PanelHost>
  );
}
