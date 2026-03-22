import {
  MESSAGE_TYPES,
  sendRuntimeMessage,
  type GetSiteStatusResponse,
  type UsageIncrementResponse,
} from '@/src/core/messages';
import { BLOCK_ALERT_TEXT } from '@/src/constants/text';

const POLL_INTERVAL_MS = 500;
const BLOCK_CHECK_INTERVAL_MS = 2_000;
const COMPLETION_PROGRESS_THRESHOLD = 0.5;
const COUNT_INCREASE_SOUND_EVENT_NAME = 'life-is-short:youtube-count-sound';
const COUNT_INCREASE_SOUND_ATTRIBUTE_NAME = 'data-life-is-short-youtube-count-sound';
const COUNT_INCREASE_SOUND_DURATION_SECONDS = 0.18;
const COUNT_INCREASE_SOUND_GAIN = 0.045;
const COUNT_INCREASE_SOUND_START_FREQUENCY = 880;
const COUNT_INCREASE_SOUND_END_FREQUENCY = 1_176;
const BLOCK_SCREEN_ID = 'life-is-short-youtube-block-screen';

type BrowserAudioContext = AudioContext;
type BrowserAudioContextConstructor = typeof AudioContext;

let currentPageUrl = window.location.href;
let activeVideo: HTMLVideoElement | null = null;
let completionCountedForSession = false;
let completionInFlight = false;
let lastBlockCheckTimestamp = 0;
let audioContext: BrowserAudioContext | null = null;
let blockCheckInFlight = false;
let deferBlockUntilNextSession = false;

function getAudioContextConstructor():
  | BrowserAudioContextConstructor
  | undefined {
  return window.AudioContext;
}

function getAudioContext(): BrowserAudioContext | null {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

function emitCountIncreaseSoundEvent(count: number): void {
  window.dispatchEvent(
    new CustomEvent(COUNT_INCREASE_SOUND_EVENT_NAME, {
      detail: { count },
    }),
  );
}

function markCountIncreaseSound(count: number): void {
  document.documentElement.setAttribute(
    COUNT_INCREASE_SOUND_ATTRIBUTE_NAME,
    String(count),
  );
}

async function playCountIncreaseSound(count: number): Promise<void> {
  markCountIncreaseSound(count);
  emitCountIncreaseSoundEvent(count);

  const context = getAudioContext();
  if (!context) {
    return;
  }

  try {
    if (context.state === 'suspended') {
      await context.resume();
    }
  } catch {
    return;
  }

  const startTime = context.currentTime;
  const stopTime = startTime + COUNT_INCREASE_SOUND_DURATION_SECONDS;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(
    COUNT_INCREASE_SOUND_START_FREQUENCY,
    startTime,
  );
  oscillator.frequency.exponentialRampToValueAtTime(
    COUNT_INCREASE_SOUND_END_FREQUENCY,
    stopTime,
  );

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(
    COUNT_INCREASE_SOUND_GAIN,
    startTime + 0.02,
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(stopTime);
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

function getBlockScreen(): HTMLElement | null {
  return document.getElementById(BLOCK_SCREEN_ID);
}

function pauseAllVideos(): void {
  const videos = document.querySelectorAll<HTMLVideoElement>('video');
  for (const video of videos) {
    video.pause();
  }
}

function renderBlockScreen(): void {
  if (getBlockScreen()) {
    pauseAllVideos();
    return;
  }

  const blockScreen = document.createElement('div');
  blockScreen.id = BLOCK_SCREEN_ID;
  blockScreen.setAttribute('aria-live', 'assertive');
  blockScreen.setAttribute('role', 'dialog');
  Object.assign(blockScreen.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'grid',
    placeItems: 'center',
    padding: '32px',
    background: '#000',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 'clamp(28px, 4vw, 48px)',
    lineHeight: '1.2',
    letterSpacing: '0.01em',
  });
  blockScreen.textContent = BLOCK_ALERT_TEXT;

  document.documentElement.append(blockScreen);
  pauseAllVideos();
}

function removeBlockScreen(): void {
  getBlockScreen()?.remove();
}

async function maybeShowBlockScreen(): Promise<boolean> {
  if (blockCheckInFlight) {
    return Boolean(getBlockScreen());
  }

  blockCheckInFlight = true;
  try {
    const response = await sendRuntimeMessage<GetSiteStatusResponse>({
      type: MESSAGE_TYPES.getSiteStatus,
      siteId: 'youtube',
    });

    if (!response.ok) {
      return false;
    }

    if (!response.status.blocked) {
      removeBlockScreen();
      return false;
    }

    if (deferBlockUntilNextSession) {
      return false;
    }

    renderBlockScreen();
    return true;
  } finally {
    blockCheckInFlight = false;
  }
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

    if (!response.status.extensionEnabled) {
      completionCountedForSession = true;
      deferBlockUntilNextSession = false;
      return;
    }

    completionCountedForSession = true;
    void playCountIncreaseSound(response.status.count);

    if (response.status.blocked) {
      // Let the current video finish. Enforcement happens on the next attempt.
      deferBlockUntilNextSession = true;
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
    deferBlockUntilNextSession = false;
    completionCountedForSession = false;
    completionInFlight = false;
    void maybeShowBlockScreen();
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

  if (activeVideo && video !== activeVideo) {
    deferBlockUntilNextSession = false;
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
    deferBlockUntilNextSession = false;
    completionCountedForSession = false;
    if (await maybeShowBlockScreen()) {
      return;
    }
  }

  const now = Date.now();
  if (now - lastBlockCheckTimestamp >= BLOCK_CHECK_INTERVAL_MS) {
    lastBlockCheckTimestamp = now;
    if (await maybeShowBlockScreen()) {
      return;
    }
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
  excludeMatches: ['*://music.youtube.com/*', '*://*.music.youtube.com/*'],
  runAt: 'document_start',
  main(ctx) {
    void maybeShowBlockScreen();

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
