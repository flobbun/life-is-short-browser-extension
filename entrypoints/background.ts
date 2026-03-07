import {
  MESSAGE_TYPES,
  type ErrorResponse,
  type GetDashboardStateResponse,
  type GetSiteStatusResponse,
  type RuntimeMessage,
  type RuntimeResponse,
  type UpdateThresholdResponse,
  type UsageIncrementResponse,
} from '@/src/core/messages';
import { shouldLatchBlockForYoutube, shouldSiteBeBlocked } from '@/src/core/policy-engine';
import { getSettings, updateYoutubeThreshold } from '@/src/core/settings-store';
import { getUsageStateForToday, incrementSiteUsage, latchSiteBlock } from '@/src/core/usage-store';
import type { SiteId, SiteSettings, SiteStatus, SiteUsage } from '@/src/core/types';

function toSiteStatus(args: {
  siteId: SiteId;
  usage: SiteUsage;
  settings: SiteSettings;
}): SiteStatus {
  const { siteId, usage, settings } = args;

  if (siteId === 'youtube') {
    const blocked = shouldSiteBeBlocked({
      usage,
      enabled: settings.youtube.enabled,
      threshold: settings.youtube.threshold,
    });

    return {
      siteId,
      count: usage.count,
      blocked,
      enabled: settings.youtube.enabled,
      threshold: settings.youtube.threshold,
    };
  }

  return {
    siteId,
    count: usage.count,
    blocked: shouldSiteBeBlocked({
      usage,
      enabled: settings.linkedin.enabled,
    }),
    enabled: settings.linkedin.enabled,
  };
}

async function getStatus(siteId: SiteId): Promise<SiteStatus> {
  const [usage, settings] = await Promise.all([
    getUsageStateForToday(),
    getSettings(),
  ]);

  return toSiteStatus({
    siteId,
    usage: usage.sites[siteId],
    settings,
  });
}

async function handleUsageIncrement(
  siteId: SiteId,
): Promise<UsageIncrementResponse> {
  let usage = await incrementSiteUsage(siteId);
  const settings = await getSettings();

  if (
    siteId === 'youtube' &&
    shouldLatchBlockForYoutube({
      usage: usage.sites.youtube,
      settings: settings.youtube,
    })
  ) {
    usage = await latchSiteBlock('youtube');
  }

  return {
    ok: true,
    status: toSiteStatus({
      siteId,
      usage: usage.sites[siteId],
      settings,
    }),
  };
}

async function handleThresholdUpdate(
  threshold: number,
): Promise<UpdateThresholdResponse> {
  const beforeSettings = await getSettings();
  const previousThreshold = beforeSettings.youtube.threshold;

  const nextSettings = await updateYoutubeThreshold(threshold);
  let usage = await getUsageStateForToday();

  if (
    nextSettings.youtube.threshold < previousThreshold &&
    usage.sites.youtube.count >= nextSettings.youtube.threshold
  ) {
    usage = await latchSiteBlock('youtube');
  }

  return {
    ok: true,
    status: toSiteStatus({
      siteId: 'youtube',
      usage: usage.sites.youtube,
      settings: nextSettings,
    }),
  };
}

async function handleMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  switch (message.type) {
    case MESSAGE_TYPES.usageIncrement:
      return handleUsageIncrement(message.siteId);
    case MESSAGE_TYPES.getSiteStatus:
      return {
        ok: true,
        status: await getStatus(message.siteId),
      } satisfies GetSiteStatusResponse;
    case MESSAGE_TYPES.updateThreshold:
      return handleThresholdUpdate(message.threshold);
    case MESSAGE_TYPES.getDashboardState: {
      const [usage, settings] = await Promise.all([
        getUsageStateForToday(),
        getSettings(),
      ]);

      return {
        ok: true,
        dashboard: {
          usage,
          settings,
        },
      } satisfies GetDashboardStateResponse;
    }
    default:
      throw new Error(`Unhandled message type: ${(message as RuntimeMessage).type}`);
  }
}

export default defineBackground(() => {
  // Ensure storage is initialized and current-day usage exists.
  void Promise.all([getSettings(), getUsageStateForToday()]);

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleMessage(message as RuntimeMessage)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const fallback: ErrorResponse = {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown background error',
        };
        sendResponse(fallback);
      });

    return true;
  });
});
