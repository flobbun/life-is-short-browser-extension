import { expect, test } from './extension-fixture';
import { getYoutubeStatus, resetExtensionStorage } from './helpers';

const COUNT_INCREASE_SOUND_ATTRIBUTE_NAME = 'data-life-is-short-youtube-count-sound';

test('plays the YouTube count sound when a completion increments usage', async ({
  context,
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);

  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!doctype html>
        <html lang="en">
          <head><title>YouTube Stub</title></head>
          <body>
            <div id="movie_player">
              <video class="html5-main-video"></video>
            </div>
          </body>
        </html>
      `,
    });
  });

  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=test-video', {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForTimeout(1_200);
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

  await expect
    .poll(async () =>
      (await getYoutubeStatus(dashboardPage)).count,
    )
    .toBe(1);

  await expect
    .poll(async () =>
      page.locator('html').getAttribute(COUNT_INCREASE_SOUND_ATTRIBUTE_NAME),
    )
    .toBe('1');

  const status = await getYoutubeStatus(dashboardPage);
  expect(status.count).toBe(1);
  expect(status.blocked).toBe(false);

  await page.close();
});
