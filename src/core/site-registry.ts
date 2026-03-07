import type { SiteModule } from './site-module';
import type { SiteId, SiteSettings } from './types';
import { linkedinSiteModule } from '@/src/sites/linkedin/module';
import { youtubeSiteModule } from '@/src/sites/youtube/module';

export const siteModules: SiteModule[] = [youtubeSiteModule, linkedinSiteModule];

export const siteModuleById: { [K in SiteId]: SiteModule<K> } = {
  youtube: youtubeSiteModule,
  linkedin: linkedinSiteModule,
};

export function getDefaultSiteSettings(): SiteSettings {
  return {
    youtube: siteModuleById.youtube.getDefaultSettings(),
    linkedin: siteModuleById.linkedin.getDefaultSettings(),
  };
}
