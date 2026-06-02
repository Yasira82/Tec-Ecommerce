import { test, expect } from '@playwright/test';

test('landing page redirects to shop', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForTimeout(2000);
  const url = page.url();
  expect(url.includes('/shop') || url.includes('hub.tecosystem.app')).toBeTruthy();
});

test('shop page loads or shows auth', async ({ page }) => {
  await page.goto('/shop', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);
  const hasStore  = await page.getByText('TEC Store').isVisible().catch(() => false);
  const hasAuth   = await page.getByText('Authenticating').isVisible().catch(() => false);
  const hasRetry  = await page.getByText('Retry Login').isVisible().catch(() => false);
  expect(hasStore || hasAuth || hasRetry).toBeTruthy();
});
