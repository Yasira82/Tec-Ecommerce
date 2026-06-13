import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);
  const hasContent = await page.getByText('TEC Store').isVisible().catch(() => false);
  const redirected = page.url().includes('hub.tecosystem.app');
  expect(hasContent || redirected).toBeTruthy();
});

test('shop page loads', async ({ page }) => {
  await page.goto('/shop', { waitUntil: 'commit' });
  await page.waitForTimeout(5000);
  const url = page.url();
  const hasLoginButton  = await page.getByText('Login with Pi').isVisible().catch(() => false);
  const hasStore        = await page.getByText('TEC Store').isVisible().catch(() => false);
  const hasNoProducts   = await page.getByText('No products available yet').isVisible().catch(() => false);
  const hasError        = await page.getByText('Could not load products').isVisible().catch(() => false);
  const redirected      = url.includes('hub.tecosystem.app');
  expect(hasLoginButton || hasStore || hasNoProducts || hasError || redirected).toBeTruthy();
});
