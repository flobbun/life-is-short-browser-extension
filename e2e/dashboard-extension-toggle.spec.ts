import type { Page } from '@playwright/test';
import { BLOCK_ALERT_TEXT } from '../src/constants/text';
import { expect, test } from './extension-fixture';
import {
  getDashboardState,
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

function computeArithmeticAnswer(prompt: string): number {
  const match = prompt.match(/How much is (\d+) ([+\-*]) (\d+)\?/);
  if (!match) {
    throw new Error(`Unexpected arithmetic prompt: ${prompt}`);
  }

  const left = Number(match[1]);
  const operator = match[2];
  const right = Number(match[3]);

  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

async function confirmDisableSequence(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', {
      name: 'Are you sure you want to disable it?',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Are you really really sure?',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();

  await expect(
    page.getByRole('heading', {
      name: "Seriously, you shouldn't disable this... Are you sure?",
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();

  await expect(
    page.getByRole('heading', {
      name: "C'mon bruh, stop right there! You just want to procrastinate again eh?!",
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();
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

test('disabling the extension removes blocking without resetting counters and re-enabling restores enforcement', async ({
  context,
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 1);
  await incrementYoutubeUsage(dashboardPage, 1);
  await dashboardPage.reload();

  const extensionSwitch = dashboardPage.getByRole('switch', {
    name: 'Extension enabled',
  });

  await expect(extensionSwitch).toHaveAttribute('aria-checked', 'true');
  await extensionSwitch.click();
  await confirmDisableSequence(dashboardPage);

  const arithmeticPrompt = dashboardPage.getByRole('heading', {
    name: /^How much is \d+ [+\-*] \d+\?$/,
  });
  const promptText = await arithmeticPrompt.textContent();
  if (!promptText) {
    throw new Error('Expected arithmetic prompt text');
  }

  await dashboardPage.getByLabel('Answer').fill(String(computeArithmeticAnswer(promptText)));
  await dashboardPage.getByRole('button', { name: 'Submit' }).click();

  await expect(extensionSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(
    dashboardPage.getByText('Extension is off. Blocking and counting are paused.'),
  ).toBeVisible();

  let dashboard = await getDashboardState(dashboardPage);
  expect(dashboard.settings.extensionEnabled).toBe(false);
  expect(dashboard.usage.sites.youtube.count).toBe(1);
  expect(dashboard.persistentUsage.sites.youtube.totalCount).toBe(1);

  let status = await getYoutubeStatus(dashboardPage);
  expect(status.extensionEnabled).toBe(false);
  expect(status.blocked).toBe(false);
  expect(status.count).toBe(1);

  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: getYoutubeStubHtml('Disabled Stub'),
    });
  });

  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=disabled-video', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.getByRole('heading', { name: 'Disabled Stub' })).toBeVisible();
  await expect(page.getByText(BLOCK_ALERT_TEXT)).toHaveCount(0);

  await page.waitForTimeout(1_200);
  await triggerYoutubeCompletion(page);
  await page.waitForTimeout(1_200);

  status = await getYoutubeStatus(dashboardPage);
  expect(status.count).toBe(1);
  expect(status.blocked).toBe(false);

  await extensionSwitch.click();
  await expect(extensionSwitch).toHaveAttribute('aria-checked', 'true');

  dashboard = await getDashboardState(dashboardPage);
  expect(dashboard.settings.extensionEnabled).toBe(true);
  expect(dashboard.usage.sites.youtube.count).toBe(1);

  status = await getYoutubeStatus(dashboardPage);
  expect(status.extensionEnabled).toBe(true);
  expect(status.blocked).toBe(true);
  expect(status.count).toBe(1);

  await page.goto('https://www.youtube.com/watch?v=enabled-again', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.getByText(BLOCK_ALERT_TEXT)).toBeVisible();
  await expect(page.locator('#life-is-short-youtube-block-screen')).toBeVisible();

  await page.close();
});

test('a wrong arithmetic answer cancels disabling and keeps blocking active', async ({
  dashboardPage,
}) => {
  await resetExtensionStorage(dashboardPage);
  await updateYoutubeThreshold(dashboardPage, 1);
  await incrementYoutubeUsage(dashboardPage, 1);
  await dashboardPage.reload();

  const extensionSwitch = dashboardPage.getByRole('switch', {
    name: 'Extension enabled',
  });

  await extensionSwitch.click();
  await confirmDisableSequence(dashboardPage);

  await dashboardPage.getByLabel('Answer').fill('-1');
  await dashboardPage.getByRole('button', { name: 'Submit' }).click();

  await expect(
    dashboardPage.getByRole('heading', { name: /^How much is / }),
  ).toHaveCount(0);
  await expect(extensionSwitch).toHaveAttribute('aria-checked', 'true');

  const status = await getYoutubeStatus(dashboardPage);
  expect(status.extensionEnabled).toBe(true);
  expect(status.blocked).toBe(true);
  expect(status.count).toBe(1);
});
