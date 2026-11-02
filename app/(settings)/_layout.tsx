import { Slot, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { useLoanNavigation } from '@/features/navigation';
import { SettingsPanel } from '@/panels/SettingsPanel';
import { PanelHost } from '@/ui/layout/PanelHost';
import { listPaneWidth, useLayoutClass } from '@/ui/layout/layout';
import { useTheme } from '@/ui/theme/useTheme';

/** Settings section: stack in compact, list + selected sub-page otherwise (§4.12). */
export default function SettingsLayout() {
  const cls = useLayoutClass();
  const { c } = useTheme();
  const nav = useLoanNavigation();
  const path = usePathname();
  if (cls === 'compact') return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: listPaneWidth(cls) + 40, borderRightWidth: 1, borderRightColor: c.border }}>
        <PanelHost variant="pane">
          <SettingsPanel onOpenTheme={() => nav.settings('theme')} selected={path === '/settings/theme' || path === '/settings' ? 'theme' : undefined} />
        </PanelHost>
      </View>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
