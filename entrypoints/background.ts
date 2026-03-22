import {
  MESSAGE_TYPES,
  type ErrorResponse,
  type GetDashboardStateResponse,
  type GetSiteStatusResponse,
  type RuntimeMessage,
  type RuntimeResponse,
  type UpdateExtensionEnabledMessage,
  type UpdateExtensionEnabledResponse,
  type UpdateYoutubeSettingsMessage,
  type UpdateYoutubeSettingsResponse,
  type UsageIncrementResponse,
} from '@/src/core/messages';
import { getPersistentUsageState, incrementPersistentSiteUsage } from '@/src/core/persistent-usage-store';
import { shouldLatchBlockForYoutube, shouldSiteBeBlocked } from '@/src/core/policy-engine';
import {
  getSettings,
  updateExtensionEnabled,
  updateYoutubeSettings,
} from '@/src/core/settings-store';
import {
  getUsageStateForCurrentWindow,
  incrementSiteUsage,
  latchSiteBlock,
} from '@/src/core/usage-store';
import type {
  ExtensionSettings,
  SiteId,
  SiteStatus,
  SiteUsage,
} from '@/src/core/types';

function toSiteStatus(args: {
  siteId: SiteId;
  usage: SiteUsage;
  settings: ExtensionSettings;
}): SiteStatus {
  const { siteId, usage, settings } = args;

  if (siteId === 'youtube') {
    const blocked = shouldSiteBeBlocked({
      usage,
      extensionEnabled: settings.extensionEnabled,
      enabled: settings.youtube.enabled,
      threshold: settings.youtube.threshold,
    });

    return {
      siteId,
      count: usage.count,
      blocked,
      enabled: settings.youtube.enabled,
      extensionEnabled: settings.extensionEnabled,
      threshold: settings.youtube.threshold,
      resetWindowHours: settings.youtube.resetWindowHours,
    };
  }

  return {
    siteId,
    count: usage.count,
    blocked: shouldSiteBeBlocked({
      usage,
      extensionEnabled: settings.extensionEnabled,
      enabled: settings.linkedin.enabled,
    }),
    enabled: settings.linkedin.enabled,
    extensionEnabled: settings.extensionEnabled,
  };
}

async function getStatus(siteId: SiteId): Promise<SiteStatus> {
  const settings = await getSettings();
  const usage = await getUsageStateForCurrentWindow(settings);

  return toSiteStatus({
    siteId,
    usage: usage.sites[siteId],
    settings,
  });
}

async function handleUsageIncrement(
  siteId: SiteId,
): Promise<UsageIncrementResponse> {
  const settings = await getSettings();
  let usage = await getUsageStateForCurrentWindow(settings);

  if (!settings.extensionEnabled) {
    return {
      ok: true,
      status: toSiteStatus({
        siteId,
        usage: usage.sites[siteId],
        settings,
      }),
    };
  }

  usage = await incrementSiteUsage(siteId, settings);
  await incrementPersistentSiteUsage(siteId);

  if (
    siteId === 'youtube' &&
    shouldLatchBlockForYoutube({
      usage: usage.sites.youtube,
      settings: settings.youtube,
      extensionEnabled: settings.extensionEnabled,
    })
  ) {
    usage = await latchSiteBlock('youtube', settings);
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

async function handleExtensionEnabledUpdate(
  message: UpdateExtensionEnabledMessage,
): Promise<UpdateExtensionEnabledResponse> {
  return {
    ok: true,
    settings: await updateExtensionEnabled(message.enabled),
  };
}

async function handleYoutubeSettingsUpdate(
  message: UpdateYoutubeSettingsMessage,
): Promise<UpdateYoutubeSettingsResponse> {
  const beforeSettings = await getSettings();
  const previousThreshold = beforeSettings.youtube.threshold;
  const nextSettings = await updateYoutubeSettings({
    threshold: message.threshold,
    resetWindowHours: message.resetWindowHours,
  });
  let usage = await getUsageStateForCurrentWindow(nextSettings);

  if (
    typeof message.threshold === 'number' &&
    nextSettings.youtube.threshold < previousThreshold &&
    usage.sites.youtube.count >= nextSettings.youtube.threshold
  ) {
    usage = await latchSiteBlock('youtube', nextSettings);
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
    case MESSAGE_TYPES.updateYoutubeSettings:
      return handleYoutubeSettingsUpdate(message);
    case MESSAGE_TYPES.updateExtensionEnabled:
      return handleExtensionEnabledUpdate(message);
    case MESSAGE_TYPES.getDashboardState: {
      const settings = await getSettings();
      const [usage, persistentUsage] = await Promise.all([
        getUsageStateForCurrentWindow(settings),
        getPersistentUsageState(),
      ]);

      return {
        ok: true,
        dashboard: {
          usage,
          persistentUsage,
          settings,
        },
      } satisfies GetDashboardStateResponse;
    }
    default:
      throw new Error(`Unhandled message type: ${(message as RuntimeMessage).type}`);
  }
}

export default defineBackground(() => {
  // Ensure storage is initialized and the active usage window exists.
  void (async () => {
    const settings = await getSettings();
    await Promise.all([
      getUsageStateForCurrentWindow(settings),
      getPersistentUsageState(),
    ]);
  })();

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
