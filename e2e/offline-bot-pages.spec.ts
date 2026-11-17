import { expect, test } from '@playwright/test';
import { defaultMocks, setLoginInfo } from './helpers';

test('unavailable bot reads show a retryable state without page errors', async ({ page }) => {
  await defaultMocks(page);
  for (const endpoint of ['whitelist', 'balance', 'pairlists/available', 'logs']) {
    await page.route(`**/api/v1/${endpoint}`, (route) =>
      route.fulfill({ status: 502, json: { detail: 'Bot API unavailable' } }),
    );
  }
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await setLoginInfo(page);

  for (const [path, notice] of [
    ['/graph', 'Bot chart unavailable'],
    ['/balance', 'Bot balance unavailable'],
    ['/pairlist', 'Bot pair lists unavailable'],
    ['/pairlist_config', 'Bot pairlist options unavailable'],
    ['/logs', 'Bot logs unavailable'],
  ]) {
    await page.goto(path);
    await expect(page.getByText(notice, { exact: true })).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});
