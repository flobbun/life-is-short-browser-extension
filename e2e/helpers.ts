import type { Page } from '@playwright/test';
import {
  MESSAGE_TYPES,
  type GetSiteStatusResponse,
  type RuntimeMessage,
  type RuntimeResponse,
} from '../src/core/messages';

const USAGE_STORAGE_KEY = 'lifeIsShort.usage.v1';

export async function resetExtensionStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });
}

export async function sendRuntimeMessage<TResponse extends RuntimeResponse>(
  page: Page,
  message: RuntimeMessage,
): Promise<TResponse> {
  return page.evaluate((payload) => browser.runtime.sendMessage(payload), message);
}

export async function incrementYoutubeUsage(page: Page, times = 1): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await sendRuntimeMessage(page, {
      type: MESSAGE_TYPES.usageIncrement,
      siteId: 'youtube',
    });
  }
}

export async function getYoutubeStatus(page: Page) {
  const response = await sendRuntimeMessage<GetSiteStatusResponse>(page, {
    type: MESSAGE_TYPES.getSiteStatus,
    siteId: 'youtube',
  });

  return response.status;
}

export async function updateYoutubeThreshold(
  page: Page,
  threshold: number,
): Promise<void> {
  await sendRuntimeMessage(page, {
    type: MESSAGE_TYPES.updateThreshold,
    siteId: 'youtube',
    threshold,
  });
}

export async function setUsageStateToYesterday(page: Page): Promise<void> {
  await page.evaluate(async (usageKey) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    await browser.storage.local.set({
      [usageKey]: {
        dateKey,
        sites: {
          youtube: {
            count: 7,
            blockedLatched: true,
          },
          linkedin: {
            count: 0,
            blockedLatched: false,
          },
        },
      },
    });
  }, USAGE_STORAGE_KEY);
}
