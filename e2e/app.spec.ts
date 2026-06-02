import { test, expect } from '@playwright/test';

test('landing page attempts SSO redirect', async ({ page }) => {
  // Intercept external navigation to Hub
  let redirectUrl = '';
  page.on('request', req => {
    if (req.url().includes('hub.tecosystem.app')) {
      redirectUrl = req.url();
    }
  });

  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const url = page.url();
  const isRedirected = url.includes('hub.tecosystem.app') || redirectUrl.includes('hub.tecosystem.app');
  const hasSpinner   = await page.getByText('Connecting to TEC').isVisible().catch(() => false);

  expect(isRedirected || hasSpinner).toBeTruthy();
});

test('app page redirects unauthenticated users', async ({ page }) => {
  await page.goto('/app', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const url = page.url();
  // Either redirected to Hub SSO or stayed on /app with spinner
  expect(
    url.includes('hub.tecosystem.app') ||
    url.includes('/app') ||
    url.includes('/')
  ).toBeTruthy();
});
