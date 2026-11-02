import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveLanguage } from '@/i18n';
import { useAppStore } from '@/store/appStore';
import { Button, Text } from '@/ui/components';
import { NavBar } from '@/ui/layout/NavBar';
import { useLayoutClass } from '@/ui/layout/layout';
import { ConfirmHost, Snackbar } from '@/ui/overlays';
import { ThemeProvider, useTheme } from '@/ui/theme/useTheme';
import { radius, space } from '@/ui/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { c, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const cls = useLayoutClass();
  const ready = useAppStore((s) => s.ready);
  const loadError = useAppStore((s) => s.loadError);
  const language = useAppStore((s) => s.settings?.language ?? 'system');
  const lastDeleted = useAppStore((s) => s.lastDeleted);

  useEffect(() => {
    void useAppStore.getState().init();
    // "today" is recomputed on foreground and while open (§5.10).
    const sub = AppState.addEventListener('change', (s) => s === 'active' && useAppStore.getState().refreshToday());
    const timer = setInterval(() => useAppStore.getState().refreshToday(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const lang = resolveLanguage(language);
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
    if (Platform.OS === 'web') document.documentElement.lang = lang;
  }, [language, i18n]);

  // Web: browser chrome follows the theme (§6.15).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c.bg));
    document.body.style.backgroundColor = c.bg;
    document.documentElement.style.colorScheme = mode;
  }, [c.bg, mode]);

  const rail = cls === 'expanded';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {!ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <Text color="danger">{loadError}</Text>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: rail ? 'row' : 'column-reverse' }}>
          <NavBar variant={rail ? 'rail' : 'tabs'} />
          <View style={{ flex: 1 }}>
            <Slot />
          </View>
        </View>
      )}
      {lastDeleted ? (
        <Snackbar
          message={t('overview.deleted', { name: lastDeleted.name })}
          actionLabel={t('common.undo')}
          onAction={() => void useAppStore.getState().undoDelete()}
          onTimeout={() => useAppStore.getState().dismissUndo()}
        />
      ) : null}
      <ConfirmHost />
      {ready ? <Disclaimer /> : null}
    </View>
  );
}

/** Shown once on first start (§7.5). */
function Disclaimer() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const accepted = useAppStore((s) => s.settings?.disclaimerAcceptedAt);
  if (accepted) return null;
  return (
    <View
      testID="disclaimer"
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <View style={{ width: 440, maxWidth: '100%', backgroundColor: c.surface, borderRadius: radius.l + 4, padding: space.xl, gap: space.m, borderWidth: 1, borderColor: c.border }}>
        <Text variant="display" color="primary" style={{ textAlign: 'center', fontSize: 56 }}>
          ¤
        </Text>
        <Text variant="title">{t('disclaimer.title')}</Text>
        <Text>{t('disclaimer.text')}</Text>
        <Button
          label={t('disclaimer.accept')}
          testID="accept-disclaimer"
          onPress={() => void useAppStore.getState().updateSettings({ disclaimerAcceptedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') })}
        />
      </View>
    </View>
  );
}
