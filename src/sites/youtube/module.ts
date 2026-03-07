import type { SiteModule } from '@/src/core/site-module';
import type { YoutubeSettings } from '@/src/core/types';

const YOUTUBE_HOST_SUFFIXES = ['youtube.com', 'm.youtube.com', 'youtu.be'];

export function isYoutubeHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  return YOUTUBE_HOST_SUFFIXES.some(
    (suffix) => normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`),
  );
}

export function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isYoutubeHost(parsed.hostname);
  } catch {
    return false;
  }
}

export const youtubeSiteModule: SiteModule<'youtube'> = {
  id: 'youtube',
  displayName: 'YouTube',
  matches: isYoutubeUrl,
  getDefaultSettings: (): YoutubeSettings => ({
    enabled: true,
    threshold: 3,
  }),
};
