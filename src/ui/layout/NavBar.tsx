import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/useTheme';
import { font, space, systemFont } from '../theme/tokens';

/** Bottom tab bar (compact, medium) or navigation rail (expanded), §4.12. */
export function NavBar({ variant }: { variant: 'tabs' | 'rail' }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const inSettings = path.startsWith('/settings');
  const items = [
    { key: 'loans', label: t('tabs.loans'), icon: 'wallet' as const, href: '/', active: !inSettings },
    { key: 'settings', label: t('tabs.settings'), icon: 'settings' as const, href: '/settings', active: inSettings },
  ];
  const rail = variant === 'rail';
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: rail ? 'column' : 'row',
        backgroundColor: c.surface,
        borderColor: c.border,
        ...(rail ? { width: 84, borderRightWidth: 1, paddingTop: space.l, gap: space.s } : { borderTopWidth: 1, paddingBottom: insets.bottom }),
      }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: it.active }}
          accessibilityLabel={it.label}
          testID={`tab-${it.key}`}
          onPress={() => {
            if (it.active && path === it.href) return;
            router.replace(it.href as never);
          }}
          style={({ pressed }) => ({
            flex: rail ? undefined : 1,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 52,
            paddingVertical: space.s,
            gap: 2,
            opacity: pressed ? 0.7 : 1,
          })}>
          <View style={{ paddingHorizontal: space.l, paddingVertical: 4, borderRadius: 16, backgroundColor: it.active ? c.surfaceAlt : 'transparent' }}>
            <Ionicons name={it.active ? it.icon : (`${it.icon}-outline` as const)} size={22} color={it.active ? c.primary : c.textMuted} />
          </View>
          <RNText style={{ fontSize: font.xs, color: it.active ? c.primary : c.textMuted, fontWeight: it.active ? '700' : '500', fontFamily: systemFont }}>{it.label}</RNText>
        </Pressable>
      ))}
    </View>
  );
}
