import { getDefaultSiteSettings } from './site-registry';
import {
  clampYoutubeResetWindowHours,
  clampYoutubeThreshold,
} from './policy-engine';
import type { ExtensionSettings, SiteSettings } from './types';

const SETTINGS_STORAGE_KEY = 'lifeIsShort.settings.v1';

function normalizeSettings(
  partial: Partial<ExtensionSettings> | undefined,
): ExtensionSettings {
  const defaults = getDefaultSiteSettings();

  return {
    extensionEnabled: partial?.extensionEnabled ?? true,
    youtube: {
      enabled: partial?.youtube?.enabled ?? defaults.youtube.enabled,
      threshold: clampYoutubeThreshold(
        partial?.youtube?.threshold ?? defaults.youtube.threshold,
      ),
      resetWindowHours: clampYoutubeResetWindowHours(
        partial?.youtube?.resetWindowHours ?? defaults.youtube.resetWindowHours,
      ),
    },
    linkedin: {
      enabled: partial?.linkedin?.enabled ?? defaults.linkedin.enabled,
    },
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await browser.storage.sync.get(SETTINGS_STORAGE_KEY);
  const normalized = normalizeSettings(
    result[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined,
  );

  await browser.storage.sync.set({ [SETTINGS_STORAGE_KEY]: normalized });
  return normalized;
}

export async function updateYoutubeSettings(
  updates: Partial<
    Pick<SiteSettings['youtube'], 'threshold' | 'resetWindowHours'>
  >,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const nextSettings: ExtensionSettings = {
    ...settings,
    youtube: {
      ...settings.youtube,
      threshold:
        typeof updates.threshold === 'number'
          ? clampYoutubeThreshold(updates.threshold)
          : settings.youtube.threshold,
      resetWindowHours:
        typeof updates.resetWindowHours === 'number'
          ? clampYoutubeResetWindowHours(updates.resetWindowHours)
          : settings.youtube.resetWindowHours,
    },
  };

  await browser.storage.sync.set({ [SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

export async function updateExtensionEnabled(
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const nextSettings: ExtensionSettings = {
    ...settings,
    extensionEnabled: enabled,
  };

  await browser.storage.sync.set({ [SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.sync.set({
    [SETTINGS_STORAGE_KEY]: normalizeSettings(settings),
  });
}
