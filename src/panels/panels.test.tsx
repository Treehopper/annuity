import { defaultSettings, type Loan } from '@alp/core';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDraftStore } from '@/features/loanForm';
import i18n from '@/i18n';
import { useAppStore } from '@/store/appStore';
import { FixedPane } from '@/ui/layout/layout';
import { ThemeProvider } from '@/ui/theme/useTheme';

import { LoanDetailPanel } from './LoanDetailPanel';
import { LoanEditPanel } from './LoanEditPanel';
import { LoanListPanel } from './LoanListPanel';
import { SchedulePanel } from './SchedulePanel';
import { ThemePanel } from './ThemePanel';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = jest.requireActual('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{`[${name}]`}</Text>;
  return { __esModule: true, default: Icon };
});

/** Reference loan of the mockups (§6, golden test G8), active, today 2026-10-15. */
const g8: Loan = {
  id: 'g8',
  name: 'DummyBank 10y',
  status: 'active',
  params: {
    principal: '280000.00',
    nominalRate: '0.0308',
    payoutDate: '2024-06-15',
    firstPaymentDate: '2024-07-01',
    fixedRateMonths: 120,
    payment: { mode: 'term', termMonths: 216 },
    rounding: 'bank',
  },
  specialRules: [{ id: 'r1', frequency: 'monthly', amount: '1100.00', start: '2024-07-01' }],
  specialOverrides: [{ id: 'o1', date: '2026-11-01', kind: 'changed', amount: '800.00', confirmed: false }],
  followUp: { rate: '0.0308', payment: { mode: 'keepPayment' }, keepSpecialRules: true },
  notifications: { monthlyBreakdown: false, fixedRateEndMonthsBefore: [12, 6] },
  createdAt: '2024-05-20T18:02:11Z',
  updatedAt: '2024-05-20T18:02:11Z',
};
g8.baseline = { params: g8.params, specialRules: g8.specialRules, followUp: g8.followUp, createdAt: '2024-06-10T07:30:00Z' };
const offer: Loan = { ...g8, id: 'b', name: 'Bank B 10y', status: 'offer', baseline: undefined, specialOverrides: [], specialRules: [] };

beforeEach(() => {
  useAppStore.setState({ ready: true, loans: [g8, offer], settings: { ...defaultSettings(), disclaimerAcceptedAt: '2026-01-01T00:00:00Z' }, today: '2026-10-15' });
});

const at = (width: number, ui: ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <FixedPane width={width}>{ui}</FixedPane>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const WIDTHS = [360, 600, 1000];

describe.each(WIDTHS)('panels at %ipx (§4.12 rule 10)', (width) => {
  it('LoanListPanel', async () => {
    await at(width, <LoanListPanel onSelectLoan={jest.fn()} onCreateLoan={jest.fn()} />);
    expect(screen.getByText('DummyBank 10y')).toBeTruthy();
    expect(screen.getByText('Bank B 10y')).toBeTruthy();
  });

  it('LoanDetailPanel shows the mockup figures (§6.5)', async () => {
    await at(width, <LoanDetailPanel loanId="g8" menu={[]} onOpenSchedule={jest.fn()} />);
    expect(screen.getByText('This month · 10/01/2026')).toBeTruthy();
    expect(screen.getAllByText('€570.21').length).toBeGreaterThan(0);
    expect(screen.getByText('€219,939.51')).toBeTruthy();
    expect(screen.getByText('Paid off before end: 03/2034')).toBeTruthy();
    expect(screen.getByText('+€75.95')).toBeTruthy();
    expect(screen.getByText('28 special repayments to confirm ›')).toBeTruthy();
  });

  it('SchedulePanel picks its variant from the pane width (§6.6)', async () => {
    await at(width, <SchedulePanel loanId="g8" granularity="monthly" projection="current" onChangeView={jest.fn()} />);
    // The single-line table has an "Opening" column; the two-line rows don't.
    expect(screen.queryAllByText('Opening').length > 0).toBe(width >= 560);
  });

  it('LoanEditPanel locks contract data of active loans', async () => {
    await at(width, <LoanEditPanel loanId="g8" onSaved={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Contract data is locked for active loans.')).toBeTruthy();
    expect(screen.getByTestId('field-principal').props.editable).toBe(false);
    expect(screen.getByTestId('field-name').props.editable).not.toBe(false);
  });

  it('LoanEditPanel draft stays valid after a language switch in Settings (regression)', async () => {
    await at(width, <LoanEditPanel loanId="b" onSaved={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('field-principal').props.value).toBe('280,000.00');
    // Settings → language → German, then back to the still-open draft.
    await act(() => i18n.changeLanguage('de'));
    try {
      expect(screen.getByTestId('field-principal').props.value).toBe('280.000,00');
      expect(screen.queryByText('Zwischen 1.000 € und 10.000.000 €.')).toBeNull();
    } finally {
      await act(() => i18n.changeLanguage('en'));
      useDraftStore.setState({ drafts: {} });
    }
  });

  it('ThemePanel lists all five palettes', async () => {
    await at(width, <ThemePanel />);
    for (const name of ['Classic', 'Solarized', 'Nord', 'Gruvbox', 'Catppuccin']) expect(screen.getByLabelText(name)).toBeTruthy();
  });
});
