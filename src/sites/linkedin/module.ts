import type { SiteModule } from '@/src/core/site-module';
import type { LinkedinSettings } from '@/src/core/types';

export function isLinkedinUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const normalizedHost = parsed.hostname.toLowerCase();
    return (
      normalizedHost === 'linkedin.com' || normalizedHost.endsWith('.linkedin.com')
    );
  } catch {
    return false;
  }
}

export const linkedinSiteModule: SiteModule<'linkedin'> = {
  id: 'linkedin',
  displayName: 'LinkedIn',
  matches: isLinkedinUrl,
  getDefaultSettings: (): LinkedinSettings => ({
    enabled: false,
  }),
};
