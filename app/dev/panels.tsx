import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { LoanDetailPanel } from '@/panels/LoanDetailPanel';
import { LoanListPanel } from '@/panels/LoanListPanel';
import { SchedulePanel } from '@/panels/SchedulePanel';
import { ThemePanel } from '@/panels/ThemePanel';
import { useAppStore } from '@/store/appStore';
import { Text } from '@/ui/components';
import { FixedPane } from '@/ui/layout/layout';
import { useTheme } from '@/ui/theme/useTheme';
import { space } from '@/ui/theme/tokens';

const WIDTHS = [360, 600, 1000];
const noop = () => {};

/** Development-only gallery: every panel at 360/600/1,000 px (§4.12 rule 10). */
export default function DevPanels() {
  const { c } = useTheme();
  const loan = useAppStore((s) => s.loans[0]);
  if (!__DEV__) return <Redirect href="/" />;
  const panels: [string, () => React.ReactNode][] = [
    ['LoanListPanel', () => <LoanListPanel onSelectLoan={noop} onCreateLoan={noop} />],
    ['ThemePanel', () => <ThemePanel />],
  ];
  if (loan)
    panels.push(
      ['LoanDetailPanel', () => <LoanDetailPanel loanId={loan.id} menu={[]} onOpenSchedule={noop} />],
      ['SchedulePanel', () => <SchedulePanel loanId={loan.id} granularity="monthly" projection="current" onChangeView={noop} />],
    );
  return (
    <ScrollView contentContainerStyle={{ padding: space.l, gap: space.xl }}>
      {!loan ? <Text variant="muted">Create a loan to see the loan panels.</Text> : null}
      {panels.map(([name, render]) => (
        <View key={name} style={{ gap: space.s }}>
          <Text variant="heading">{name}</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: space.l }}>
            {WIDTHS.map((w) => (
              <View key={w} style={{ width: w, height: 640, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
                <Text variant="small">{w}px</Text>
                <FixedPane width={w}>{render()}</FixedPane>
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}
