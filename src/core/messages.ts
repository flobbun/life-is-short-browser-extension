import type { DashboardState, SiteId, SiteStatus } from './types';

export const MESSAGE_TYPES = {
  usageIncrement: 'USAGE_INCREMENT',
  getSiteStatus: 'GET_SITE_STATUS',
  updateThreshold: 'UPDATE_THRESHOLD',
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

export type UpdateThresholdMessage = {
  type: typeof MESSAGE_TYPES.updateThreshold;
  siteId: 'youtube';
  threshold: number;
};

export type GetDashboardStateMessage = {
  type: typeof MESSAGE_TYPES.getDashboardState;
};

export type RuntimeMessage =
  | UsageIncrementMessage
  | GetSiteStatusMessage
  | UpdateThresholdMessage
  | GetDashboardStateMessage;

export type UsageIncrementResponse = {
  ok: true;
  status: SiteStatus;
};

export type GetSiteStatusResponse = {
  ok: true;
  status: SiteStatus;
};

export type UpdateThresholdResponse = {
  ok: true;
  status: SiteStatus;
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
  | UpdateThresholdResponse
  | GetDashboardStateResponse;

export type RuntimeResponse = SuccessRuntimeResponse | ErrorResponse;

export async function sendRuntimeMessage<TResponse extends SuccessRuntimeResponse>(
  message: RuntimeMessage,
): Promise<TResponse | ErrorResponse> {
  return browser.runtime.sendMessage(message) as Promise<TResponse | ErrorResponse>;
}
