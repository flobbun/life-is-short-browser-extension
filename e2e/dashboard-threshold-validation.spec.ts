import { expect, test } from './extension-fixture';
import {
  getYoutubeStatus,
  resetExtensionStorage,
  updateYoutubeThreshold,
} from './helpers';

test('auto-saves threshold changes and clamps out-of-range values', async ({
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await dashboardPage.reload();

  const thresholdInput = dashboardPage.getByLabel('Threshold (1-10)');

  await thresholdInput.fill('99');
  await thresholdInput.dispatchEvent('change');
  await expect(thresholdInput).toHaveValue('10');

  let status = await getYoutubeStatus(dashboardPage);
  expect(status.threshold).toBe(10);

  await thresholdInput.fill('0');
  await thresholdInput.dispatchEvent('change');
  await expect(thresholdInput).toHaveValue('1');

  status = await getYoutubeStatus(dashboardPage);
  expect(status.threshold).toBe(1);

  await updateYoutubeThreshold(dashboardPage, 4);
  status = await getYoutubeStatus(dashboardPage);
  expect(status.threshold).toBe(4);
});
