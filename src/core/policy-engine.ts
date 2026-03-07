import type { SiteSettings, SiteUsage } from './types';

export const YOUTUBE_THRESHOLD_MIN = 1;
export const YOUTUBE_THRESHOLD_MAX = 10;

export function clampYoutubeThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return YOUTUBE_THRESHOLD_MIN;
  }

  return Math.max(
    YOUTUBE_THRESHOLD_MIN,
    Math.min(YOUTUBE_THRESHOLD_MAX, Math.round(value)),
  );
}

export function shouldSiteBeBlocked(args: {
  usage: SiteUsage;
  enabled: boolean;
  threshold?: number;
}): boolean {
  const { usage, enabled, threshold } = args;

  if (!enabled) {
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
}): boolean {
  const { usage, settings } = args;
  if (!settings.enabled) {
    return false;
  }

  return usage.count >= settings.threshold;
}
