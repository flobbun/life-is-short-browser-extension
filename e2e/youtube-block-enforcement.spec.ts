import type { Page } from '@playwright/test';
import { BLOCK_ALERT_TEXT } from '../src/constants/text';
import { expect, test } from './extension-fixture';
import {
  getYoutubeStatus,
  incrementYoutubeUsage,
  resetExtensionStorage,
  updateYoutubeThreshold,
} from './helpers';

function getYoutubeStubHtml(title: string): string {
  return `
    <!doctype html>
    <html lang="en">
      <head><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        <div id="movie_player">
          <video class="html5-main-video"></video>
        </div>
      </body>
    </html>
  `;
}

async function triggerYoutubeCompletion(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>(
      '#movie_player video.html5-main-video',
    );
    if (!video) {
      throw new Error('Missing test video element');
    }

    Object.defineProperty(video, 'duration', {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => 60,
    });
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      get: () => 4,
    });

    video.dispatchEvent(new Event('play'));
    video.dispatchEvent(new Event('timeupdate'));
    video.dispatchEvent(new Event('ended'));
  });
}

test('replaces blocked YouTube visits with an in-page blackout message', async ({
  context,
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 1);
  await incrementYoutubeUsage(dashboardPage, 1);

  const youtubeStatus = await getYoutubeStatus(dashboardPage);
  expect(youtubeStatus.blocked).toBe(true);

  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: getYoutubeStubHtml('Blocked Stub'),
    });
  });

  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=blocked-video', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/youtube\.com\/watch\?v=blocked-video/);
  await expect(page.getByText(BLOCK_ALERT_TEXT)).toBeVisible();
  await expect(page.locator('#life-is-short-youtube-block-screen')).toBeVisible();

  await page.close();
});

test('lets the threshold-reaching video continue and blocks the next watch attempt', async ({
  context,
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 3);
  await incrementYoutubeUsage(dashboardPage, 2);

  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: getYoutubeStubHtml('Watch Stub'),
    });
  });

  const thirdVideoUrl = 'https://www.youtube.com/watch?v=third-video';
  const fourthVideoUrl = 'https://www.youtube.com/watch?v=fourth-video';
  const page = await context.newPage();

  await page.goto(thirdVideoUrl, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForTimeout(1_200);

  await expect
    .poll(async () => {
      await triggerYoutubeCompletion(page);
      return getYoutubeStatus(dashboardPage);
    })
    .toMatchObject({
      count: 3,
      blocked: true,
    });

  await page.waitForTimeout(2_500);
  await expect(page).toHaveURL(thirdVideoUrl);
  await expect(page.getByText(BLOCK_ALERT_TEXT)).toHaveCount(0);

  await page.goto(fourthVideoUrl, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(fourthVideoUrl);
  await expect(page.getByText(BLOCK_ALERT_TEXT)).toBeVisible();
  await expect(page.locator('#life-is-short-youtube-block-screen')).toBeVisible();

  await page.close();
});

test('does not block or count visits on music.youtube.com', async ({
  context,
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 1);
  await incrementYoutubeUsage(dashboardPage, 1);

  const youtubeStatus = await getYoutubeStatus(dashboardPage);
  expect(youtubeStatus.blocked).toBe(true);
  expect(youtubeStatus.count).toBe(1);

  await context.route('https://music.youtube.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!doctype html>
        <html lang="en">
          <head><title>Music Stub</title></head>
          <body>
            <h1>Music Stub</h1>
            <video id="player"></video>
          </body>
        </html>
      `,
    });
  });

  const page = await context.newPage();
  await page.goto('https://music.youtube.com/watch?v=ambient-track', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/music\.youtube\.com\/watch/);
  await expect(page.getByRole('heading', { name: 'Music Stub' })).toBeVisible();
  await expect(page.getByText(BLOCK_ALERT_TEXT)).toHaveCount(0);

  await page.waitForTimeout(1_200);
  await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>('#player');
    if (!video) {
      throw new Error('Missing test video element');
    }

    Object.defineProperty(video, 'duration', {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => 60,
    });
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      get: () => 4,
    });

    video.dispatchEvent(new Event('play'));
    video.dispatchEvent(new Event('timeupdate'));
    video.dispatchEvent(new Event('ended'));
  });

  await dashboardPage.reload();

  const statusAfterMusicVisit = await getYoutubeStatus(dashboardPage);
  expect(statusAfterMusicVisit.count).toBe(1);
  expect(statusAfterMusicVisit.blocked).toBe(true);

  await page.close();
});
