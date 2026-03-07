import { expect, test } from './extension-fixture';
import {
  getYoutubeStatus,
  incrementYoutubeUsage,
  resetExtensionStorage,
  setUsageStateToYesterday,
  updateYoutubeThreshold,
} from './helpers';

test('keeps block latched on threshold raise, then resets count and unblock next day', async ({
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);

  await updateYoutubeThreshold(dashboardPage, 5);
  await incrementYoutubeUsage(dashboardPage, 4);

  let status = await getYoutubeStatus(dashboardPage);
  expect(status.blocked).toBe(false);
  expect(status.count).toBe(4);

  await updateYoutubeThreshold(dashboardPage, 3);
  status = await getYoutubeStatus(dashboardPage);
  expect(status.blocked).toBe(true);

  await updateYoutubeThreshold(dashboardPage, 10);
  status = await getYoutubeStatus(dashboardPage);
  expect(status.blocked).toBe(true);

  await setUsageStateToYesterday(dashboardPage);
  status = await getYoutubeStatus(dashboardPage);

  expect(status.count).toBe(0);
  expect(status.blocked).toBe(false);
});
