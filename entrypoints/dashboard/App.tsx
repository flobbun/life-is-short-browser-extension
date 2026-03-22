import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  MESSAGE_TYPES,
  sendRuntimeMessage,
  type GetDashboardStateResponse,
  type UpdateExtensionEnabledResponse,
  type UpdateYoutubeSettingsResponse,
} from '@/src/core/messages';
import {
  clampYoutubeResetWindowHours,
  clampYoutubeThreshold,
  YOUTUBE_RESET_WINDOW_HOURS_MAX,
  YOUTUBE_RESET_WINDOW_HOURS_MIN,
  YOUTUBE_THRESHOLD_MAX,
  YOUTUBE_THRESHOLD_MIN,
} from '@/src/core/policy-engine';

const HOUR_IN_MS = 60 * 60 * 1000;
const DISABLE_CONFIRMATION_MESSAGES = [
  'Are you sure you want to disable it?',
  'Are you really really sure?',
  "Seriously, you shouldn't disable this... Are you sure?",
  "C'mon bruh, stop right there! You just want to procrastinate again eh?!",
] as const;

type DisableConfirmationStep = 1 | 2 | 3 | 4 | 5;

type ArithmeticChallenge = {
  prompt: string;
  answer: number;
};

function formatTimeRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function getRandomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createArithmeticChallenge(): ArithmeticChallenge {
  const operationType = getRandomInteger(0, 2);

  if (operationType === 0) {
    const left = getRandomInteger(6, 25);
    const right = getRandomInteger(3, 18);

    return {
      prompt: `How much is ${left} + ${right}?`,
      answer: left + right,
    };
  }

  if (operationType === 1) {
    const right = getRandomInteger(2, 15);
    const left = getRandomInteger(right + 5, right + 22);

    return {
      prompt: `How much is ${left} - ${right}?`,
      answer: left - right,
    };
  }

  const left = getRandomInteger(2, 12);
  const right = getRandomInteger(2, 12);

  return {
    prompt: `How much is ${left} * ${right}?`,
    answer: left * right,
  };
}

function App() {
  const [dashboard, setDashboard] =
    useState<GetDashboardStateResponse['dashboard'] | null>(null);
  const [thresholdInput, setThresholdInput] = useState<string>('3');
  const [resetWindowInput, setResetWindowInput] = useState<string>('8');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [disableConfirmationStep, setDisableConfirmationStep] =
    useState<DisableConfirmationStep | null>(null);
  const [arithmeticChallenge, setArithmeticChallenge] =
    useState<ArithmeticChallenge | null>(null);
  const [challengeInput, setChallengeInput] = useState<string>('');
  const [confirmationError, setConfirmationError] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<string>('');

  const applyDashboardState = (response: GetDashboardStateResponse) => {
    const youtubeSettings = response.dashboard.settings.youtube;

    setDashboard(response.dashboard);
    setThresholdInput(String(youtubeSettings.threshold));
    setResetWindowInput(String(youtubeSettings.resetWindowHours));
    setNowMs(Date.now());
  };

  const loadDashboardState = async () => {
    const response = await sendRuntimeMessage<GetDashboardStateResponse>({
      type: MESSAGE_TYPES.getDashboardState,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    applyDashboardState(response);
    setError('');
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        await loadDashboardState();
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();

    const dashboardRefreshIntervalId = window.setInterval(() => {
      void loadDashboardState().catch(() => undefined);
    }, 2_000);
    const countdownIntervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(dashboardRefreshIntervalId);
      window.clearInterval(countdownIntervalId);
    };
  }, []);

  const extensionEnabled = dashboard?.settings.extensionEnabled ?? true;
  const youtubeUsage = dashboard?.usage.sites.youtube;
  const youtubePersistentUsage = dashboard?.persistentUsage.sites.youtube;
  const youtubeSettings = dashboard?.settings.youtube;
  const count = youtubeUsage?.count ?? 0;
  const todayCount = youtubePersistentUsage?.todayCount ?? 0;
  const totalCount = youtubePersistentUsage?.totalCount ?? 0;
  const threshold = youtubeSettings?.threshold ?? 3;
  const resetWindowHours = youtubeSettings?.resetWindowHours ?? 8;
  const windowStartedAt = youtubeUsage?.windowStartedAt ?? null;

  const clampedThresholdPreview = useMemo(() => {
    const numeric = Number(thresholdInput);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return clampYoutubeThreshold(numeric);
  }, [thresholdInput]);

  const clampedResetWindowPreview = useMemo(() => {
    const numeric = Number(resetWindowInput);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return clampYoutubeResetWindowHours(numeric);
  }, [resetWindowInput]);

  const resetCountdown = useMemo(() => {
    if (count === 0) {
      return {
        label: 'Reset window',
        value: 'Starts after the first video',
      };
    }

    if (windowStartedAt === null) {
      return {
        label: count >= threshold ? 'Block resets in' : 'Window resets in',
        value: '...',
      };
    }

    const remainingMs = Math.max(
      0,
      windowStartedAt + resetWindowHours * HOUR_IN_MS - nowMs,
    );

    return {
      label: count >= threshold ? 'Block resets in' : 'Window resets in',
      value: formatTimeRemaining(remainingMs),
    };
  }, [count, nowMs, resetWindowHours, threshold, windowStartedAt]);

  const closeDisableConfirmation = () => {
    setDisableConfirmationStep(null);
    setArithmeticChallenge(null);
    setChallengeInput('');
    setConfirmationError('');
  };

  const updateExtensionEnabledSetting = async (
    enabled: boolean,
  ): Promise<{ ok: boolean; message?: string }> => {
    setError('');
    setStatusNotice('');
    setIsSaving(true);

    try {
      const response = await sendRuntimeMessage<UpdateExtensionEnabledResponse>({
        type: MESSAGE_TYPES.updateExtensionEnabled,
        enabled,
      });

      if (!response.ok) {
        const message = response.error || 'Failed to update extension status.';
        setError(message);
        return { ok: false, message };
      }

      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          settings: response.settings,
        };
      });

      setStatusNotice(
        enabled ? 'Extension enabled again.' : 'Extension disabled.',
      );
      return { ok: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update extension status.';
      setError(message);
      return { ok: false, message };
    } finally {
      setIsSaving(false);
    }
  };

  const updateYoutubeSettings = async (updates: {
    threshold?: number;
    resetWindowHours?: number;
  }) => {
    setError('');
    setIsSaving(true);

    try {
      const response = await sendRuntimeMessage<UpdateYoutubeSettingsResponse>({
        type: MESSAGE_TYPES.updateYoutubeSettings,
        siteId: 'youtube',
        ...updates,
      });

      if (!response.ok) {
        throw new Error(response.error);
      }

      await loadDashboardState();
    } catch {
      setError('Failed to update YouTube settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateThreshold = async (rawValue: string) => {
    setThresholdInput(rawValue);

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    await updateYoutubeSettings({
      threshold: clampYoutubeThreshold(parsed),
    });
  };

  const updateResetWindow = async (rawValue: string) => {
    setResetWindowInput(rawValue);

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    await updateYoutubeSettings({
      resetWindowHours: clampYoutubeResetWindowHours(parsed),
    });
  };

  const handleExtensionToggle = async () => {
    if (isLoading || isSaving) {
      return;
    }

    if (!extensionEnabled) {
      await updateExtensionEnabledSetting(true);
      return;
    }

    setError('');
    setStatusNotice('');
    setConfirmationError('');
    setDisableConfirmationStep(1);
  };

  const advanceDisableConfirmation = () => {
    if (disableConfirmationStep === null) {
      return;
    }

    if (disableConfirmationStep < 4) {
      setDisableConfirmationStep(
        (disableConfirmationStep + 1) as DisableConfirmationStep,
      );
      return;
    }

    setArithmeticChallenge(createArithmeticChallenge());
    setChallengeInput('');
    setConfirmationError('');
    setDisableConfirmationStep(5);
  };

  const submitArithmeticChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!arithmeticChallenge) {
      return;
    }

    if (Number(challengeInput.trim()) !== arithmeticChallenge.answer) {
      closeDisableConfirmation();
      setStatusNotice('Disable canceled.');
      return;
    }

    setConfirmationError('');

    const result = await updateExtensionEnabledSetting(false);
    if (!result.ok) {
      setConfirmationError(
        result.message || 'Failed to disable the extension. Try again.',
      );
      return;
    }

    closeDisableConfirmation();
  };

  return (
    <main className="dashboard-root">
        <button
          type="button"
          className="extension-switch"
          role="switch"
          aria-checked={extensionEnabled}
          aria-label="Extension enabled"
          onClick={() => void handleExtensionToggle()}
          disabled={isLoading || isSaving}
        >
          <span className="extension-switch-copy">
            <span className="extension-switch-label">Extension</span>
            <span className="extension-switch-state">
              {extensionEnabled ? 'On' : 'Off'}
            </span>
          </span>
          <span className="extension-switch-track" aria-hidden="true">
            <span className="extension-switch-thumb" />
          </span>
        </button>

      <section className="dashboard-card" aria-label="YouTube">
        <div className="card-overview">
          <div className="card-copy">
            <h2>YouTube</h2>
            <p className="section-copy">
              Reaching the video limit blocks YouTube until the active reset
              window expires.
            </p>
            {!extensionEnabled ? (
              <p className="status-text">
                Extension is off. Blocking and counting are paused.
              </p>
            ) : null}
          </div>

          <div className="settings-wrapper">
            <div className="settings-grid">
              <div className="setting-field">
                <label className="field-label" htmlFor="youtube-threshold">
                  Threshold ({YOUTUBE_THRESHOLD_MIN}-{YOUTUBE_THRESHOLD_MAX})
                </label>
                <input
                  id="youtube-threshold"
                  name="youtube-threshold"
                  className="threshold-input"
                  type="number"
                  min={YOUTUBE_THRESHOLD_MIN}
                  max={YOUTUBE_THRESHOLD_MAX}
                  step={1}
                  value={thresholdInput}
                  onChange={(event) =>
                    void updateThreshold(event.currentTarget.value)
                  }
                />
                <p className="field-help">
                  Block after this many completed videos.
                </p>
              </div>

              <div className="setting-field">
                <label className="field-label" htmlFor="youtube-reset-window">
                  Reset window (hours)
                </label>
                <input
                  id="youtube-reset-window"
                  name="youtube-reset-window"
                  className="threshold-input"
                  type="number"
                  min={YOUTUBE_RESET_WINDOW_HOURS_MIN}
                  max={YOUTUBE_RESET_WINDOW_HOURS_MAX}
                  step={1}
                  value={resetWindowInput}
                  onChange={(event) =>
                    void updateResetWindow(event.currentTarget.value)
                  }
                />
                <p className="field-help">
                  Reset the counter after this many hours.
                </p>
              </div>
            </div>

            <div className="metric-panel">
              <div className="metric-grid">
                <div className="metric-item">
                  <p className="metric-label">Videos watched this window</p>
                  <p className="metric-value">{isLoading ? '...' : count}</p>
                </div>
                <div className="metric-item">
                  <p className="metric-label">Videos watched today</p>
                  <p className="metric-value metric-value-secondary">
                    {isLoading ? '...' : todayCount}
                  </p>
                </div>
                <div className="metric-item">
                  <p className="metric-label">Videos watched total</p>
                  <p className="metric-value metric-value-secondary">
                    {isLoading ? '...' : totalCount}
                  </p>
                </div>
              </div>
              <p className="metric-timer-label">{resetCountdown.label}</p>
              <p className="metric-timer-value">{resetCountdown.value}</p>
            </div>
          </div>
        </div>

        {clampedThresholdPreview !== null &&
        clampedThresholdPreview !== Number(thresholdInput) ? (
          <p className="hint-text">
            Threshold will be clamped to: {clampedThresholdPreview}
          </p>
        ) : null}
        {clampedResetWindowPreview !== null &&
        clampedResetWindowPreview !== Number(resetWindowInput) ? (
          <p className="hint-text">
            Reset window will be clamped to: {clampedResetWindowPreview}
          </p>
        ) : null}
        {isSaving ? <p className="status-text">Saving...</p> : null}
        {statusNotice ? <p className="status-text">{statusNotice}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {disableConfirmationStep !== null ? (
        <div className="modal-backdrop">
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-extension-title"
          >
            <h2 id="disable-extension-title" className="confirmation-title">
              {disableConfirmationStep === 5
                ? arithmeticChallenge?.prompt
                : DISABLE_CONFIRMATION_MESSAGES[disableConfirmationStep - 1]}
            </h2>

            {disableConfirmationStep === 5 ? (
              <form onSubmit={(event) => void submitArithmeticChallenge(event)}>
                <label className="field-label" htmlFor="disable-extension-answer">
                  Answer
                </label>
                <input
                  id="disable-extension-answer"
                  className="threshold-input modal-input"
                  type="number"
                  value={challengeInput}
                  onChange={(event) => setChallengeInput(event.currentTarget.value)}
                  autoFocus
                />
                {confirmationError ? (
                  <p className="error-text modal-error-text">{confirmationError}</p>
                ) : null}
                <div className="confirmation-actions">
                  <button type="submit" className="confirmation-button confirm">
                    Submit
                  </button>
                  <button
                    type="button"
                    className="confirmation-button cancel"
                    onClick={closeDisableConfirmation}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="confirmation-actions">
                <button
                  type="button"
                  className="confirmation-button confirm"
                  onClick={advanceDisableConfirmation}
                  autoFocus
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="confirmation-button cancel"
                  onClick={closeDisableConfirmation}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
