import { useLoanNavigation } from '@/features/navigation';
import { SettingsPanel } from '@/panels/SettingsPanel';
import { ThemePanel } from '@/panels/ThemePanel';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

export default function SettingsRoute() {
  const cls = useLayoutClass();
  const nav = useLoanNavigation();
  // Two-pane: the list is rendered by the layout; the detail shows the first sub-page.
  if (cls !== 'compact')
    return (
      <PanelHost variant="pane">
        <ThemePanel />
      </PanelHost>
    );
  return (
    <PanelHost>
      <SettingsPanel onOpenTheme={() => nav.settings('theme')} />
    </PanelHost>
  );
}
