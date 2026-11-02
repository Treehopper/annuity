import { Slot, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { useLoanNavigation } from '@/features/navigation';
import { LoanListPanel } from '@/panels/LoanListPanel';
import { useAppStore } from '@/store/appStore';
import { PanelHost } from '@/ui/layout/PanelHost';
import { listPaneWidth, useLayoutClass } from '@/ui/layout/layout';
import { useTheme } from '@/ui/theme/useTheme';

/** Loans section: stack in compact, list + detail side by side otherwise (§4.12 rule 5). */
export default function LoansLayout() {
  const cls = useLayoutClass();
  const { c } = useTheme();
  const count = useAppStore((s) => s.loans.length);
  const path = usePathname();
  const nav = useLoanNavigation();
  if (cls === 'compact') return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;

  const selectedId = /^\/loan\/([^/]+)/.exec(path)?.[1];
  // Single-loan rule: list pane hidden, detail full width (§6.2). No loans: the empty state fills the screen.
  const showList = count > 1;
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {showList ? (
        <View style={{ width: listPaneWidth(cls), borderRightWidth: 1, borderRightColor: c.border }} testID="list-pane">
          <PanelHost variant="pane">
            <LoanListPanel
              selectedId={selectedId === 'new' ? undefined : selectedId}
              onSelectLoan={nav.selectLoan}
              onCreateLoan={nav.createLoan}
              onDuplicated={nav.selectLoan}
              onDeleted={nav.afterDelete}
            />
          </PanelHost>
        </View>
      ) : null}
      <View style={{ flex: 1 }} testID="detail-pane">
        <Slot />
      </View>
    </View>
  );
}
