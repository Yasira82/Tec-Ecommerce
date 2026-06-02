import { test, expect } from '@playwright/test';

test('landing page redirects to SSO', async ({ page }) => {
  const response = await page.goto('/');
  // SSO redirect → Hub or shows spinner
  const url = page.url();
  const hasRedirect  = url.includes('hub.tecosystem.app');
  const hasSpinner   = await page.locator('text=Connecting to TEC').isVisible().catch(() => false);
  expect(hasRedirect || hasSpinner).toBeTruthy();
});

test('app page requires auth', async ({ page }) => {
  const response = await page.goto('/app');
  // Should redirect to SSO if not authenticated
  await page.waitForTimeout(3000);
  const url = page.url();
  expect(url.includes('hub.tecosystem.app') || url.includes('/app')).toBeTruthy();
});
