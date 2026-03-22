import type { SiteSettings, SiteUsage } from './types';

export const YOUTUBE_THRESHOLD_MIN = 1;
export const YOUTUBE_THRESHOLD_MAX = 10;
export const YOUTUBE_RESET_WINDOW_HOURS_MIN = 1;
export const YOUTUBE_RESET_WINDOW_HOURS_MAX = 24;

export function clampYoutubeThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return YOUTUBE_THRESHOLD_MIN;
  }

  return Math.max(
    YOUTUBE_THRESHOLD_MIN,
    Math.min(YOUTUBE_THRESHOLD_MAX, Math.round(value)),
  );
}

export function clampYoutubeResetWindowHours(value: number): number {
  if (!Number.isFinite(value)) {
    return YOUTUBE_RESET_WINDOW_HOURS_MIN;
  }

  return Math.max(
    YOUTUBE_RESET_WINDOW_HOURS_MIN,
    Math.min(YOUTUBE_RESET_WINDOW_HOURS_MAX, Math.round(value)),
  );
}

export function shouldSiteBeBlocked(args: {
  usage: SiteUsage;
  extensionEnabled: boolean;
  enabled: boolean;
  threshold?: number;
}): boolean {
  const { usage, extensionEnabled, enabled, threshold } = args;

  if (!extensionEnabled || !enabled) {
    return false;
  }

  if (usage.blockedLatched) {
    return true;
  }

  if (typeof threshold === 'number') {
    return usage.count >= threshold;
  }

  return false;
}

export function shouldLatchBlockForYoutube(args: {
  usage: SiteUsage;
  settings: SiteSettings['youtube'];
  extensionEnabled: boolean;
}): boolean {
  const { usage, settings, extensionEnabled } = args;
  if (!extensionEnabled || !settings.enabled) {
    return false;
  }

  return usage.count >= settings.threshold;
}
