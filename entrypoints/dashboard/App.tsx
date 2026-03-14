import { useEffect, useMemo, useState } from 'react';
import {
  MESSAGE_TYPES,
  sendRuntimeMessage,
  type GetDashboardStateResponse,
  type UpdateThresholdResponse,
} from '@/src/core/messages';
import {
  clampYoutubeThreshold,
  YOUTUBE_THRESHOLD_MAX,
  YOUTUBE_THRESHOLD_MIN,
} from '@/src/core/policy-engine';

function App() {
  const [count, setCount] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(3);
  const [thresholdInput, setThresholdInput] = useState<string>('3');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const applyDashboardState = (response: GetDashboardStateResponse) => {
    const youtubeUsage = response.dashboard.usage.sites.youtube;
    const youtubeSettings = response.dashboard.settings.youtube;

    setCount(youtubeUsage.count);
    setThreshold(youtubeSettings.threshold);
    setThresholdInput(String(youtubeSettings.threshold));
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

  const clampedPreview = useMemo(() => {
    const numeric = Number(thresholdInput);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return clampYoutubeThreshold(numeric);
  }, [thresholdInput]);

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

    const intervalId = window.setInterval(() => {
      void loadDashboardState().catch(() => undefined);
    }, 2_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const updateThreshold = async (rawValue: string) => {
    setThresholdInput(rawValue);
    setError('');

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const nextThreshold = clampYoutubeThreshold(parsed);
    setIsSaving(true);

    try {
      const response = await sendRuntimeMessage<UpdateThresholdResponse>({
        type: MESSAGE_TYPES.updateThreshold,
        siteId: 'youtube',
        threshold: nextThreshold,
      });

      if (!response.ok) {
        throw new Error(response.error);
      }

      setThreshold(response.status.threshold ?? nextThreshold);
      setThresholdInput(String(response.status.threshold ?? nextThreshold));
      setCount(response.status.count);
    } catch {
      setError('Failed to update threshold.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="dashboard-root">
      <header>
        <h1>Life is short Dashboard</h1>
      </header>

      <section className="dashboard-card" aria-label="YouTube">
        <h2>YouTube</h2>

        <p className="metric-label">Videos watched today</p>
        <p className="metric-value">{isLoading ? '...' : count}</p>

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
          onChange={(event) => void updateThreshold(event.currentTarget.value)}
        />

        <p className="hint-text">Current threshold: {threshold}</p>
        {clampedPreview !== null && clampedPreview !== Number(thresholdInput) ? (
          <p className="hint-text">Will be clamped to: {clampedPreview}</p>
        ) : null}
        {isSaving ? <p className="status-text">Saving...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
