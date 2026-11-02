import { PALETTE_IDS, type PaletteId } from '@alp/core';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAppStore } from '@/store/appStore';
import { Button, Card, SectionTitle, Segmented, StatusBadge, Text } from '@/ui/components';
import { usePanelChrome } from '@/ui/layout/chrome';
import { paletteNames, palettes, type Mode } from '@/ui/theme/palettes';
import { useTheme } from '@/ui/theme/useTheme';
import { radius, space } from '@/ui/theme/tokens';

/** Theme chooser with live preview (§6.16). */
export function ThemePanel() {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  usePanelChrome({ title: t('theme.title') }, [t]);
  if (!settings) return null;
  return (
    <ScrollView contentContainerStyle={{ padding: space.l, gap: space.s, paddingBottom: space.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' }} testID="theme-panel">
      <Text variant="muted">{t('settings.appearance')}</Text>
      <Segmented
        value={settings.appearance}
        onChange={(appearance) => update({ appearance })}
        options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.appearances.${v}`) }))}
      />
      <View style={{ height: space.m }} />
      {PALETTE_IDS.map((id) => (
        <PaletteRow key={id} id={id} selected={settings.palette === id} activeMode={theme.mode} onPress={() => update({ palette: id })} />
      ))}
      <SectionTitle>{t('theme.preview')}</SectionTitle>
      <PreviewCard />
    </ScrollView>
  );
}

function PaletteRow({ id, selected, activeMode, onPress }: { id: PaletteId; selected: boolean; activeMode: Mode; onPress(): void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={paletteNames[id]}
      onPress={onPress}
      testID={`palette-${id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: space.m,
        padding: space.m,
        borderRadius: radius.m,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
      })}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
      </View>
      <Text bold={selected} style={{ flex: 1, minWidth: 100 }}>
        {paletteNames[id]}
      </Text>
      {(['light', 'dark'] as const).map((m) => {
        const p = palettes[id][m];
        const inUse = selected && m === activeMode;
        return (
          <View
            key={m}
            accessibilityLabel={`${t(`theme.${m}`)}${inUse ? `, ${t('theme.inUse')}` : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderRadius: radius.s, borderWidth: 2, borderColor: inUse ? c.text : 'transparent' }}>
            {[p.bg, p.surface, p.primary, p.chart2].map((col, i) => (
              <View key={i} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: col, borderWidth: 1, borderColor: p.border }} />
            ))}
            <Text variant="small">{t(`theme.${m}`)}</Text>
          </View>
        );
      })}
    </Pressable>
  );
}

function PreviewCard() {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const de = i18n.language === 'de';
  return (
    <Card testID="theme-preview">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading">DummyBank 10y</Text>
        <StatusBadge status="active" label={t('status.active')} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>{t('detail.payment')} {de ? '1.690,28 €' : '€1,690.28'}</Text>
        <Text color="positive">✓</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text italic color="warning">
          {t('detail.payoff')} 07/2034*
        </Text>
        <Button compact label={t('theme.button')} />
      </View>
      <Svg width="100%" height={60} viewBox="0 0 300 60" preserveAspectRatio="none">
        <Path d="M0,5 L120,30 L200,45" stroke={c.chart1} strokeWidth={2} fill="none" />
        <Path d="M200,45 L300,58" stroke={c.chart1} strokeWidth={2} fill="none" strokeDasharray="2,4" />
        <Path d="M0,5 L150,25 L300,50" stroke={c.chart2} strokeWidth={2} fill="none" />
        <Path d="M0,5 L100,35 L220,58" stroke={c.chart3} strokeWidth={2} fill="none" />
      </Svg>
      <Text variant="small" color="danger">
        {t('err.principal.range')}
      </Text>
    </Card>
  );
}
