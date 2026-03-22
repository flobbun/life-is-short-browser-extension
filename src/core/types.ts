export const SITE_IDS = ['youtube', 'linkedin'] as const;

export type SiteId = (typeof SITE_IDS)[number];

export type YoutubeSettings = {
  enabled: boolean;
  threshold: number;
  resetWindowHours: number;
};

export type LinkedinSettings = {
  enabled: boolean;
};

export type SiteSettings = {
  youtube: YoutubeSettings;
  linkedin: LinkedinSettings;
};

export type ExtensionSettings = SiteSettings & {
  extensionEnabled: boolean;
};

export type SiteUsage = {
  count: number;
  blockedLatched: boolean;
  windowStartedAt: number;
};

export type UsageState = {
  sites: Record<SiteId, SiteUsage>;
};

export type SitePersistentUsage = {
  totalCount: number;
  todayCount: number;
  todayKey: string;
};

export type PersistentUsageState = {
  sites: Record<SiteId, SitePersistentUsage>;
};

export type SiteStatus = {
  siteId: SiteId;
  count: number;
  blocked: boolean;
  enabled: boolean;
  extensionEnabled: boolean;
  threshold?: number;
  resetWindowHours?: number;
};

export type DashboardState = {
  usage: UsageState;
  persistentUsage: PersistentUsageState;
  settings: ExtensionSettings;
};
