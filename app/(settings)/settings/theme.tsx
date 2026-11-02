import { useLoanNavigation } from '@/features/navigation';
import { ThemePanel } from '@/panels/ThemePanel';
import { PanelHost } from '@/ui/layout/PanelHost';
import { useLayoutClass } from '@/ui/layout/layout';

export default function ThemeRoute() {
  const cls = useLayoutClass();
  const nav = useLoanNavigation();
  return (
    <PanelHost variant={cls === 'compact' ? 'stack' : 'pane'} onBack={cls === 'compact' ? nav.backToSettings : undefined}>
      <ThemePanel />
    </PanelHost>
  );
}
