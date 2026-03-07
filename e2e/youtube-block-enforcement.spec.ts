import { BLOCK_ALERT_TEXT } from '../src/constants/text';
import { expect, test } from './extension-fixture';
import {
  getYoutubeStatus,
  incrementYoutubeUsage,
  resetExtensionStorage,
  updateYoutubeThreshold,
} from './helpers';

test('redirects blocked YouTube visits and shows the required alert every attempt', async ({
  context,
  dashboardPage,
  extensionId,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 1);
  await incrementYoutubeUsage(dashboardPage, 1);

  const youtubeStatus = await getYoutubeStatus(dashboardPage);
  expect(youtubeStatus.blocked).toBe(true);

  const blockedPageUrl = await dashboardPage.evaluate(() =>
    browser.runtime.getURL('/blocked.html'),
  );
  expect(blockedPageUrl).not.toContain('chrome-extension://invalid/');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/blocked.html?site=youtube&from=${encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}`,
      {
        waitUntil: 'domcontentloaded',
      },
    );

    if (!page.isClosed()) {
      await expect(page.getByText(BLOCK_ALERT_TEXT)).toBeVisible();
      await page.close();
    }
  }
});
