import { expect, test } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BASE: string = require('../scripts/base-path.cjs')();
const esc = BASE.replace(/[/.]/g, '\\$&');

// PWA plumbing (README §4.11, Q9). App-agnostic: only checks that the app root renders.

const appRendered = async (page: import('@playwright/test').Page) =>
  expect.poll(() => page.evaluate(() => document.querySelector('#root')?.childElementCount ?? 0)).toBeGreaterThan(0);

test('manifest is linked with the base-path scope', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe(`${BASE}manifest.webmanifest`);
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    start_url: BASE,
    scope: BASE,
    display: 'standalone',
  });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

test('iOS home-screen meta tags', async ({ page, request }) => {
  await page.goto('./');
  const content = (sel: string) => page.locator(sel).getAttribute('content');
  expect(await content('meta[name="viewport"]')).toContain('viewport-fit=cover');
  expect(await content('meta[name="apple-mobile-web-app-capable"]')).toBe('yes');
  expect(await content('meta[name="mobile-web-app-capable"]')).toBe('yes');
  expect(await content('meta[name="apple-mobile-web-app-status-bar-style"]')).toBe('default');
  expect(await content('meta[name="apple-mobile-web-app-title"]')).toBe('Loan Planner');
  expect(await page.locator('meta[name="theme-color"]').count()).toBe(2);
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(touchIcon!)).ok()).toBe(true);
  expect(await page.locator('html').getAttribute('lang')).toBeTruthy();
});

test('deep link loads the app (GitHub Pages 404 fallback)', async ({ page }) => {
  const res = await page.goto('./loan/does-not-exist');
  expect(res?.status()).toBe(404); // Pages semantics: 404.html = index.html
  await appRendered(page);
});

test('service worker controls the page and serves deep links offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(new RegExp(`${esc}sw\\.js$`));
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  expect(scope).toMatch(new RegExp(`${esc}$`));

  await context.setOffline(true);
  await page.goto('./loan/some-id/schedule');
  await appRendered(page);
  await context.setOffline(false);
});
