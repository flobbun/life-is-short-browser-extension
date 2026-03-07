export const SITE_IDS = ['youtube', 'linkedin'] as const;

export type SiteId = (typeof SITE_IDS)[number];

export type YoutubeSettings = {
  enabled: boolean;
  threshold: number;
};

export type LinkedinSettings = {
  enabled: boolean;
};

export type SiteSettings = {
  youtube: YoutubeSettings;
  linkedin: LinkedinSettings;
};

export type SiteUsage = {
  count: number;
  blockedLatched: boolean;
};

export type DailyUsageState = {
  dateKey: string;
  sites: Record<SiteId, SiteUsage>;
};

export type SiteStatus = {
  siteId: SiteId;
  count: number;
  blocked: boolean;
  enabled: boolean;
  threshold?: number;
};

export type DashboardState = {
  usage: DailyUsageState;
  settings: SiteSettings;
};
