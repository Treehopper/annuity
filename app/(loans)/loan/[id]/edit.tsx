import { Redirect, useLocalSearchParams } from 'expo-router';

import { useLoanNavigation } from '@/features/navigation';
import { useLoan } from '@/features/projections';
import { LoanEditPanel } from '@/panels/LoanEditPanel';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

export default function EditLoanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useLoanNavigation();
  const cls = useLayoutClass();
  const loan = useLoan(id);
  if (!loan) return <Redirect href="/" />;
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'}>
      <LoanEditPanel loanId={loan.id} onSaved={nav.afterSave} onCancel={() => nav.backToLoan(loan.id)} />
    </PanelHost>
  );
}
