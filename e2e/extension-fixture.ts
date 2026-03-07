import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  dashboardPage: Page;
};

const extensionPath = process.env.EXTENSION_PATH ?? path.resolve('.output/chrome-mv3');

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use, testInfo) => {
    if (!fs.existsSync(extensionPath)) {
      throw new Error(
        `Built extension not found at ${extensionPath}. Run \`bun run build\` first or set EXTENSION_PATH.`,
      );
    }

    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `life-is-short-${testInfo.workerIndex}-`),
    );

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: process.env.PW_HEADLESS === '1',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },

  dashboardPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await use(page);
    await page.close();
  },
});

export { expect };
