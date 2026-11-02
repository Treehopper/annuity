import { expect, test, type Page } from '@playwright/test';

/**
 * App flows on the exported web build (README §7.1), on an iPhone (WebKit, compact layout)
 * and a desktop browser (expanded two-pane layout).
 */

/** Stack screens below the top one stay in the DOM; only consider what is visible. */
const vis = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

async function start(page: Page) {
  await page.goto('./');
  await page.getByTestId('accept-disclaimer').click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
}

interface LoanInput {
  name: string;
  principal?: string;
  rate: string;
  mode?: 'term' | 'initialRepayment';
  value: string;
  special?: string;
  fixed?: '60' | '120';
}

async function createLoan(page: Page, l: LoanInput) {
  await page.getByTestId('field-name').fill(l.name);
  await page.getByTestId('field-principal').fill(l.principal ?? '280000');
  await page.getByTestId('field-rate').fill(l.rate);
  await page.getByTestId(`fixed-${l.fixed ?? '120'}`).click();
  await page.getByTestId('field-payout').fill('2024-06-15');
  await page.getByTestId('field-first-payment').fill('2024-07-01');
  if (l.mode === 'term') {
    await page.getByTestId('payment-mode-term').click();
    await page.getByTestId('field-term').fill(l.value);
  } else {
    await page.getByTestId('field-initial-repayment').fill(l.value);
  }
  if (l.special) {
    await page.getByTestId('add-rule').click();
    await page.getByTestId('rule-0-amount').fill(l.special);
  }
  await page.getByTestId('edit-save').click();
}

const dummyBank: LoanInput = { name: 'DummyBank 10y', rate: '3.08', mode: 'term', value: '18', special: '1100' };
const bankB: LoanInput = { name: 'Bank B 10y', rate: '3.32', value: '8.6' };

test('first loan: create, key figures, persistence and single-loan start (A1, A5, A8)', async ({ page }) => {
  await start(page);
  await page.getByTestId('create-first-loan').click();
  await createLoan(page, dummyBank);

  const detail = vis(page, 'loan-detail');
  await expect(detail).toBeVisible();
  await expect(page).toHaveURL(/\/loan\/[0-9a-f-]{36}$/);
  // Golden test G2 values (bank mode).
  await expect(vis(page, 'fixed-end')).toContainText('€0.00');
  await expect(vis(page, 'fixed-end')).toContainText('Paid off before end: 03/2034');
  await expect(vis(page, 'payoff')).toContainText('€44,176.24');
  await expect(vis(page, 'payoff')).toContainText('€127,600.00');

  // Reload: data comes from IndexedDB, "/" opens the only loan's detail without a back arrow.
  await page.goto('./');
  await expect(page).toHaveURL(/\/loan\/[0-9a-f-]{36}$/);
  await expect(heading(page, 'DummyBank 10y')).toBeVisible();
  await expect(page.getByTestId('header-back')).toHaveCount(0);
});

test('second loan, overview sorting and schedule (B1, A8, §6.6)', async ({ page }) => {
  await start(page);
  await page.getByTestId('create-first-loan').click();
  await createLoan(page, dummyBank);
  await vis(page, 'header-menu').click();
  await page.getByTestId('menu-newLoan').click();
  await createLoan(page, bankB);
  await expect(heading(page, 'Bank B 10y')).toBeVisible();
  await expect(vis(page, 'payoff')).toContainText('€48,640.37'); // G5

  // The overview is the root again.
  if (await vis(page, 'header-back').count()) await vis(page, 'header-back').click();
  const cards = page.locator('[data-testid^="loan-card-"]').filter({ visible: true });
  await expect(cards).toHaveCount(2);
  await page.getByTestId('sort-button').click();
  await page.getByTestId('sort-rate').click();
  await expect(cards.first()).toHaveAttribute('data-testid', 'loan-card-DummyBank 10y');
  await page.getByTestId('sort-direction').click();
  await expect(cards.first()).toHaveAttribute('data-testid', 'loan-card-Bank B 10y');

  // Schedule deep link with a jump target survives a reload.
  await cards.first().click();
  await vis(page, 'open-schedule').click();
  await expect(vis(page, 'schedule')).toBeVisible();
  await page.getByTestId('granularity-yearly').click();
  await expect(page).toHaveURL(/view=yearly/);
  await page.reload();
  await expect(page.getByTestId('year-2024-full')).toBeVisible();
});

test('activate a loan: this-month card and original plan (C1, C4)', async ({ page }) => {
  await start(page);
  await page.getByTestId('create-first-loan').click();
  await createLoan(page, dummyBank);
  await vis(page, 'header-menu').click();
  await page.getByTestId('menu-activate').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(vis(page, 'this-month')).toBeVisible();
  await expect(vis(page, 'vs-plan')).toBeVisible();
  await expect(vis(page, 'unconfirmed-chip')).toBeVisible();
});

test('German language, theme and appearance (D4, D5, D6)', async ({ page }) => {
  await start(page);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('language-de').click();
  await expect(page.getByTestId('tab-loans')).toContainText('Darlehen');
  await expect(vis(page, 'settings')).toBeVisible();
  // Compact: theme is a sub-page; two-pane: it is already shown next to the list.
  if (!(await vis(page, 'theme-panel').count())) await vis(page, 'open-theme').click();
  await page.getByTestId('palette-solarized').click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(253, 246, 227)');
  await page.getByTestId('tab-loans').click();
  await page.getByTestId('create-first-loan').click();
  await createLoan(page, { ...dummyBank, rate: '3,08' });
  await expect(vis(page, 'payoff')).toContainText('44.176,24');
  // Settings persist across reloads.
  await page.reload();
  await expect(page.getByTestId('tab-loans')).toContainText('Darlehen');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(253, 246, 227)');
});

test('validation messages and live preview (A1, §5.6)', async ({ page }) => {
  await start(page);
  await page.getByTestId('create-first-loan').click();
  await page.getByTestId('field-rate').fill('25');
  await expect(page.getByText('Between 0 % and 20 %, at most 3 decimals.')).toBeVisible();
  await expect(page.getByTestId('preview-bar')).toContainText('Complete the highlighted fields');
  await page.getByTestId('field-rate').fill('3.32');
  await page.getByTestId('field-initial-repayment').fill('8.6');
  await expect(page.getByTestId('payment-result')).toHaveText('€2,980.00'); // 300,000 € template amount × (3.32 % + 8.6 %) / 12
  await page.getByTestId('edit-save').click();
  await expect(page.getByText('Please enter a name.')).toBeVisible();
});

test('works offline once installed (PWA)', async ({ page, context }) => {
  await start(page);
  await page.getByTestId('create-first-loan').click();
  await createLoan(page, dummyBank);
  await expect(vis(page, 'loan-detail')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(heading(page, 'DummyBank 10y')).toBeVisible();
  await vis(page, 'open-schedule').click();
  await expect(vis(page, 'schedule')).toBeVisible();
  await context.setOffline(false);
});
