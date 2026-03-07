import { getLocalDateKey, isSameLocalDay } from './date-key';
import type { DailyUsageState, SiteId, SiteUsage } from './types';

const USAGE_STORAGE_KEY = 'lifeIsShort.usage.v1';

function createInitialSiteUsage(): SiteUsage {
  return {
    count: 0,
    blockedLatched: false,
  };
}

export function createEmptyDailyUsageState(dateKey = getLocalDateKey()): DailyUsageState {
  return {
    dateKey,
    sites: {
      youtube: createInitialSiteUsage(),
      linkedin: createInitialSiteUsage(),
    },
  };
}

function normalizeUsageState(
  partial: Partial<DailyUsageState> | undefined,
): DailyUsageState {
  const dateKey = partial?.dateKey ?? getLocalDateKey();

  return {
    dateKey,
    sites: {
      youtube: {
        count: partial?.sites?.youtube?.count ?? 0,
        blockedLatched: partial?.sites?.youtube?.blockedLatched ?? false,
      },
      linkedin: {
        count: partial?.sites?.linkedin?.count ?? 0,
        blockedLatched: partial?.sites?.linkedin?.blockedLatched ?? false,
      },
    },
  };
}

export async function getUsageState(): Promise<DailyUsageState> {
  const result = await browser.storage.local.get(USAGE_STORAGE_KEY);
  const normalized = normalizeUsageState(
    result[USAGE_STORAGE_KEY] as Partial<DailyUsageState> | undefined,
  );

  await browser.storage.local.set({ [USAGE_STORAGE_KEY]: normalized });
  return normalized;
}

export async function getUsageStateForToday(): Promise<DailyUsageState> {
  const usage = await getUsageState();
  if (isSameLocalDay(usage.dateKey)) {
    return usage;
  }

  const resetState = createEmptyDailyUsageState();
  await saveUsageState(resetState);
  return resetState;
}

export async function saveUsageState(state: DailyUsageState): Promise<void> {
  await browser.storage.local.set({ [USAGE_STORAGE_KEY]: state });
}

export async function incrementSiteUsage(
  siteId: SiteId,
): Promise<DailyUsageState> {
  const usage = await getUsageStateForToday();
  const nextUsage: DailyUsageState = {
    ...usage,
    sites: {
      ...usage.sites,
      [siteId]: {
        ...usage.sites[siteId],
        count: usage.sites[siteId].count + 1,
      },
    },
  };

  await saveUsageState(nextUsage);
  return nextUsage;
}

export async function latchSiteBlock(siteId: SiteId): Promise<DailyUsageState> {
  const usage = await getUsageStateForToday();
  if (usage.sites[siteId].blockedLatched) {
    return usage;
  }

  const nextUsage: DailyUsageState = {
    ...usage,
    sites: {
      ...usage.sites,
      [siteId]: {
        ...usage.sites[siteId],
        blockedLatched: true,
      },
    },
  };

  await saveUsageState(nextUsage);
  return nextUsage;
}
