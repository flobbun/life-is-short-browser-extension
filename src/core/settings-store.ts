import { getDefaultSiteSettings } from './site-registry';
import { clampYoutubeThreshold } from './policy-engine';
import type { SiteSettings } from './types';

const SETTINGS_STORAGE_KEY = 'lifeIsShort.settings.v1';

function normalizeSettings(partial: Partial<SiteSettings> | undefined): SiteSettings {
  const defaults = getDefaultSiteSettings();

  return {
    youtube: {
      enabled: partial?.youtube?.enabled ?? defaults.youtube.enabled,
      threshold: clampYoutubeThreshold(
        partial?.youtube?.threshold ?? defaults.youtube.threshold,
      ),
    },
    linkedin: {
      enabled: partial?.linkedin?.enabled ?? defaults.linkedin.enabled,
    },
  };
}

export async function getSettings(): Promise<SiteSettings> {
  const result = await browser.storage.sync.get(SETTINGS_STORAGE_KEY);
  const normalized = normalizeSettings(
    result[SETTINGS_STORAGE_KEY] as Partial<SiteSettings> | undefined,
  );

  await browser.storage.sync.set({ [SETTINGS_STORAGE_KEY]: normalized });
  return normalized;
}

export async function updateYoutubeThreshold(
  threshold: number,
): Promise<SiteSettings> {
  const settings = await getSettings();
  const nextSettings: SiteSettings = {
    ...settings,
    youtube: {
      ...settings.youtube,
      threshold: clampYoutubeThreshold(threshold),
    },
  };

  await browser.storage.sync.set({ [SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

export async function setSettings(settings: SiteSettings): Promise<void> {
  await browser.storage.sync.set({
    [SETTINGS_STORAGE_KEY]: normalizeSettings(settings),
  });
}
