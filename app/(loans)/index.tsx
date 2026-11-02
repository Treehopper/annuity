import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useLoanNavigation } from '@/features/navigation';
import { LoanListPanel } from '@/panels/LoanListPanel';
import { useAppStore } from '@/store/appStore';
import { Text } from '@/ui/components';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';
import { space } from '@/ui/theme/tokens';

export default function OverviewRoute() {
  const loans = useAppStore((s) => s.loans);
  const cls = useLayoutClass();
  const nav = useLoanNavigation();
  const { t } = useTranslation();
  // Exactly one loan: open its detail directly, replacing "/" (§6.2, DL-22).
  if (loans.length === 1) return <Redirect href={`/loan/${loans[0]!.id}`} />;
  if (cls !== 'compact' && loans.length > 1)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Text variant="muted">{t('overview.selectHint')}</Text>
      </View>
    );
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'}>
      <LoanListPanel onSelectLoan={nav.selectLoan} onCreateLoan={nav.createLoan} onDuplicated={nav.selectLoan} onDeleted={nav.afterDelete} />
    </PanelHost>
  );
}
