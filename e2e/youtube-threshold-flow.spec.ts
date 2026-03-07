import { expect, test } from './extension-fixture';
import {
  getYoutubeStatus,
  incrementYoutubeUsage,
  resetExtensionStorage,
  updateYoutubeThreshold,
} from './helpers';

test('configures threshold and blocks after hitting completion count', async ({
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await dashboardPage.reload();

  const thresholdInput = dashboardPage.getByLabel('Threshold (1-10)');
  await expect(thresholdInput).toHaveValue('3');

  await updateYoutubeThreshold(dashboardPage, 2);
  await dashboardPage.reload();

  await expect(thresholdInput).toHaveValue('2');

  await incrementYoutubeUsage(dashboardPage, 2);

  const status = await getYoutubeStatus(dashboardPage);
  expect(status.count).toBe(2);
  expect(status.blocked).toBe(true);
});
