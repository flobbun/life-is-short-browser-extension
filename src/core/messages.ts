import type {
  DashboardState,
  ExtensionSettings,
  SiteId,
  SiteStatus,
} from './types';

export const MESSAGE_TYPES = {
  usageIncrement: 'USAGE_INCREMENT',
  getSiteStatus: 'GET_SITE_STATUS',
  updateYoutubeSettings: 'UPDATE_YOUTUBE_SETTINGS',
  updateExtensionEnabled: 'UPDATE_EXTENSION_ENABLED',
  getDashboardState: 'GET_DASHBOARD_STATE',
} as const;

export type UsageIncrementMessage = {
  type: typeof MESSAGE_TYPES.usageIncrement;
  siteId: SiteId;
};

export type GetSiteStatusMessage = {
  type: typeof MESSAGE_TYPES.getSiteStatus;
  siteId: SiteId;
};

export type UpdateYoutubeSettingsMessage = {
  type: typeof MESSAGE_TYPES.updateYoutubeSettings;
  siteId: 'youtube';
  threshold?: number;
  resetWindowHours?: number;
};

export type UpdateExtensionEnabledMessage = {
  type: typeof MESSAGE_TYPES.updateExtensionEnabled;
  enabled: boolean;
};

export type GetDashboardStateMessage = {
  type: typeof MESSAGE_TYPES.getDashboardState;
};

export type RuntimeMessage =
  | UsageIncrementMessage
  | GetSiteStatusMessage
  | UpdateYoutubeSettingsMessage
  | UpdateExtensionEnabledMessage
  | GetDashboardStateMessage;

export type UsageIncrementResponse = {
  ok: true;
  status: SiteStatus;
};

export type GetSiteStatusResponse = {
  ok: true;
  status: SiteStatus;
};

export type UpdateYoutubeSettingsResponse = {
  ok: true;
  status: SiteStatus;
};

export type UpdateExtensionEnabledResponse = {
  ok: true;
  settings: ExtensionSettings;
};

export type GetDashboardStateResponse = {
  ok: true;
  dashboard: DashboardState;
};

export type ErrorResponse = {
  ok: false;
  error: string;
};

export type SuccessRuntimeResponse =
  | UsageIncrementResponse
  | GetSiteStatusResponse
  | UpdateYoutubeSettingsResponse
  | UpdateExtensionEnabledResponse
  | GetDashboardStateResponse;

export type RuntimeResponse = SuccessRuntimeResponse | ErrorResponse;

export async function sendRuntimeMessage<TResponse extends SuccessRuntimeResponse>(
  message: RuntimeMessage,
): Promise<TResponse | ErrorResponse> {
  return browser.runtime.sendMessage(message) as Promise<TResponse | ErrorResponse>;
}
