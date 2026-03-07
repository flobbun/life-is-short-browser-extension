import {
  MESSAGE_TYPES,
  sendRuntimeMessage,
  type GetSiteStatusResponse,
  type UsageIncrementResponse,
} from '@/src/core/messages';
import { getExtensionUrl } from '@/src/core/runtime-url';

const BLOCKED_PAGE_PATH = '/blocked.html';
const POLL_INTERVAL_MS = 500;
const BLOCK_CHECK_INTERVAL_MS = 2_000;
const COMPLETION_PROGRESS_THRESHOLD = 0.5;

let currentPageUrl = window.location.href;
let activeVideo: HTMLVideoElement | null = null;
let completionCountedForSession = false;
let completionInFlight = false;
let lastBlockCheckTimestamp = 0;

function getBlockedPageUrl(fromUrl: string): string | null {
  const baseUrl = getExtensionUrl(BLOCKED_PAGE_PATH);
  if (!baseUrl) {
    return null;
  }

  const blockedUrl = new URL(baseUrl);
  blockedUrl.searchParams.set('site', 'youtube');
  blockedUrl.searchParams.set('from', fromUrl);
  return blockedUrl.toString();
}

function isAtPlaybackStart(video: HTMLVideoElement): boolean {
  return video.currentTime <= 1;
}

function getVideoProgress(video: HTMLVideoElement): number | null {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return video.currentTime / duration;
}

function getTrackedVideoElement(): HTMLVideoElement | null {
  const activeShortsVideo = document.querySelector<HTMLVideoElement>(
    'ytd-reel-video-renderer[is-active] video',
  );
  if (activeShortsVideo) {
    return activeShortsVideo;
  }

  const watchPageVideo = document.querySelector<HTMLVideoElement>(
    '#movie_player video.html5-main-video',
  );
  if (watchPageVideo) {
    return watchPageVideo;
  }

  const allVideos = Array.from(document.querySelectorAll('video'));
  if (allVideos.length === 0) {
    return null;
  }

  const playingVideos = allVideos.filter(
    (video) =>
      !video.paused &&
      video.readyState >= 2 &&
      Number.isFinite(video.duration) &&
      video.duration > 0,
  );

  if (playingVideos.length > 0) {
    return playingVideos.sort((first, second) => second.currentTime - first.currentTime)[0];
  }

  return allVideos[0];
}

function maybeRecordCompletionFromActiveVideo(): void {
  if (!activeVideo || completionCountedForSession || completionInFlight) {
    return;
  }

  const progress = getVideoProgress(activeVideo);
  if (progress !== null && progress >= COMPLETION_PROGRESS_THRESHOLD) {
    void recordCompletion();
  }
}

async function redirectIfBlocked(): Promise<boolean> {
  const response = await sendRuntimeMessage<GetSiteStatusResponse>({
    type: MESSAGE_TYPES.getSiteStatus,
    siteId: 'youtube',
  });

  if (!response.ok) {
    return false;
  }

  if (!response.status.blocked) {
    return false;
  }

  const blockedUrl = getBlockedPageUrl(window.location.href);
  if (blockedUrl && window.location.href !== blockedUrl) {
    window.location.replace(blockedUrl);
  }

  return true;
}

async function recordCompletion(): Promise<void> {
  if (completionCountedForSession || completionInFlight) {
    return;
  }

  completionInFlight = true;
  try {
    const response = await sendRuntimeMessage<UsageIncrementResponse>({
      type: MESSAGE_TYPES.usageIncrement,
      siteId: 'youtube',
    });

    if (!response.ok) {
      return;
    }

    completionCountedForSession = true;

    if (response.status.blocked) {
      const blockedUrl = getBlockedPageUrl(window.location.href);
      if (blockedUrl) {
        window.location.replace(blockedUrl);
      }
    }
  } finally {
    completionInFlight = false;
  }
}

function onVideoPlay(): void {
  if (!activeVideo) {
    return;
  }

  if (isAtPlaybackStart(activeVideo)) {
    completionCountedForSession = false;
    completionInFlight = false;
  }
}

function onVideoTimeUpdate(): void {
  maybeRecordCompletionFromActiveVideo();
}

function onVideoEnded(): void {
  if (completionCountedForSession || completionInFlight) {
    return;
  }

  void recordCompletion();
}

function detachVideoListeners(video: HTMLVideoElement): void {
  video.removeEventListener('play', onVideoPlay);
  video.removeEventListener('timeupdate', onVideoTimeUpdate);
  video.removeEventListener('ended', onVideoEnded);
}

function attachVideoListeners(video: HTMLVideoElement): void {
  video.addEventListener('play', onVideoPlay);
  video.addEventListener('timeupdate', onVideoTimeUpdate);
  video.addEventListener('ended', onVideoEnded);
}

function refreshVideoBinding(): void {
  const video = getTrackedVideoElement();

  if (video === activeVideo) {
    return;
  }

  if (activeVideo) {
    detachVideoListeners(activeVideo);
  }

  activeVideo = video;
  completionCountedForSession = false;
  completionInFlight = false;

  if (activeVideo) {
    attachVideoListeners(activeVideo);
  }
}

async function tick(): Promise<void> {
  const latestUrl = window.location.href;
  if (latestUrl !== currentPageUrl) {
    currentPageUrl = latestUrl;
    completionCountedForSession = false;
    await redirectIfBlocked();
  }

  const now = Date.now();
  if (now - lastBlockCheckTimestamp >= BLOCK_CHECK_INTERVAL_MS) {
    lastBlockCheckTimestamp = now;
    await redirectIfBlocked();
  }

  refreshVideoBinding();
  maybeRecordCompletionFromActiveVideo();
}

export default defineContentScript({
  matches: [
    '*://youtube.com/*',
    '*://*.youtube.com/*',
    '*://m.youtube.com/*',
    '*://youtu.be/*',
  ],
  runAt: 'document_start',
  main(ctx) {
    void redirectIfBlocked();

    const intervalId = ctx.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    ctx.addEventListener(window, 'beforeunload', () => {
      if (activeVideo) {
        detachVideoListeners(activeVideo);
      }
      window.clearInterval(intervalId);
    });
  },
});
