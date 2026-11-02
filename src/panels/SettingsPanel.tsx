import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, View } from 'react-native';

import { useAppStore } from '@/store/appStore';
import { Card, LinkRow, SectionTitle, Segmented, Text } from '@/ui/components';
import { usePanelChrome } from '@/ui/layout/chrome';
import { AdaptiveSheet } from '@/ui/overlays';
import { paletteNames } from '@/ui/theme/palettes';
import { space } from '@/ui/theme/tokens';

export interface SettingsPanelProps {
  onOpenTheme(): void;
  selected?: 'theme';
}

/** Settings (§6.13). Notifications and backup arrive in later milestones. */
export function SettingsPanel({ onOpenTheme, selected }: SettingsPanelProps) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  const [sheet, setSheet] = useState<'disclaimer' | 'licenses' | undefined>();
  usePanelChrome({ title: t('settings.title') }, [t]);
  if (!settings) return null;
  const version = Constants.expoConfig?.version ?? '0.1.0';
  return (
    <ScrollView contentContainerStyle={{ padding: space.l, gap: space.s, paddingBottom: space.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' }} testID="settings">
      <SectionTitle>{t('settings.language')}</SectionTitle>
      <Segmented
        testID="language"
        value={settings.language}
        onChange={(language) => update({ language })}
        options={(['system', 'de', 'en'] as const).map((v) => ({ value: v, label: t(`settings.languages.${v}`) }))}
      />
      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <Segmented
        testID="appearance"
        value={settings.appearance}
        onChange={(appearance) => update({ appearance })}
        options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.appearances.${v}`) }))}
      />
      <View style={{ height: space.s }} />
      <LinkRow label={t('settings.theme')} value={paletteNames[settings.palette]} onPress={onOpenTheme} testID="open-theme" selected={selected === 'theme'} />

      <SectionTitle>{t('settings.notifications')}</SectionTitle>
      <Text variant="muted">{t('settings.notificationsWeb')}</Text>

      <SectionTitle>{t('settings.data')}</SectionTitle>
      <Text variant="muted">{Platform.OS === 'web' ? t('settings.dataWeb') : t('settings.dataNative')}</Text>
      {Platform.OS === 'web' ? (
        <Card style={{ marginTop: space.s }}>
          <Text variant="muted">{t('settings.install')}</Text>
        </Card>
      ) : null}

      <SectionTitle>{t('settings.about')}</SectionTitle>
      <Text>{t('settings.privacy')}</Text>
      <LinkRow label={t('settings.disclaimer')} onPress={() => setSheet('disclaimer')} />
      <LinkRow label={t('settings.licenses')} onPress={() => setSheet('licenses')} />
      <Text variant="small">{t('settings.version', { version })}</Text>

      <AdaptiveSheet visible={!!sheet} title={sheet ? t(`settings.${sheet}`) : ''} onClose={() => setSheet(undefined)}>
        <Text>{sheet === 'disclaimer' ? t('disclaimer.text') : t('licenses.text')}</Text>
      </AdaptiveSheet>
    </ScrollView>
  );
}
