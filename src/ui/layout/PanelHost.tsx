import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, IconButton, StatusBadge, Text } from '../components';
import { Menu } from '../overlays';
import { useTheme } from '../theme/useTheme';
import { space, touch } from '../theme/tokens';

import { ChromeProvider, type PanelChrome } from './chrome';
import { Pane } from './layout';

/**
 * Renders a panel with the header it declares via usePanelChrome (§4.12 rule 7):
 * a stack header with back arrow in compact, a pane toolbar otherwise.
 */
export function PanelHost({ children, onBack, variant = 'stack', testID }: { children: ReactNode; onBack?: () => void; variant?: 'stack' | 'pane'; testID?: string }) {
  const [chrome, setChrome] = useState<PanelChrome>({});
  const { c } = useTheme();
  const { t } = useTranslation();
  const primary = (chrome.actions ?? []).filter((a) => a.primary);
  const secondary = (chrome.actions ?? []).filter((a) => !a.primary);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: touch + 12,
          paddingHorizontal: space.xs,
          paddingLeft: onBack ? space.xs : space.l,
          gap: space.xs,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: variant === 'pane' ? c.surface : c.bg,
        }}>
        {onBack ? <IconButton icon="arrow-back" label={t('common.back')} onPress={onBack} testID="header-back" color={c.text} /> : null}
        <Text variant={variant === 'stack' ? 'title' : 'heading'} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header" testID="header-title">
          {chrome.title ?? ''}
        </Text>
        {chrome.badge ? <StatusBadge status={chrome.badge.status} label={chrome.badge.label} /> : null}
        {primary.map((a) =>
          a.icon ? (
            <IconButton key={a.key} icon={a.icon} label={a.label} onPress={a.onPress} disabled={a.disabled} testID={a.testID ?? `action-${a.key}`} />
          ) : (
            <Button key={a.key} label={a.label} onPress={a.onPress} disabled={a.disabled} compact testID={a.testID ?? `action-${a.key}`} kind="ghost" />
          ),
        )}
        <Menu actions={secondary} label={t('common.more')} testID="header-menu" />
      </View>
      <Pane>
        <ChromeProvider onChange={setChrome}>{children}</ChromeProvider>
      </Pane>
    </View>
  );
}
