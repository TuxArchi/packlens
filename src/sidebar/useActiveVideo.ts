import { useCallback, useEffect, useState } from 'preact/hooks';
import type { VideoData } from '../core/types';

export type ViewState =
  | { status: 'loading' }
  | { status: 'not-youtube' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: VideoData };

export interface ActiveVideo {
  state: ViewState;
  reload: () => void;
}

function metricsKey(data: VideoData): string {
  const metrics = data.thumbnailMetrics;
  if (!metrics) return '';
  return `${Math.round(metrics.tonalRange)}:${Math.round(
    metrics.edgeDensity * 1000,
  )}:${Math.round(metrics.colorfulness)}`;
}

export function useActiveVideo(): ActiveVideo {
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let requestId = 0;
    let timer: number | undefined;

    async function refresh(): Promise<void> {
      const currentRequest = ++requestId;

      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (!tab?.id) {
          if (!disposed) setState({ status: 'not-youtube' });
          return;
        }

        const url = tab.url ?? '';
        if (!/^https:\/\/(www|studio)\.youtube\.com\//.test(url)) {
          if (!disposed) setState({ status: 'not-youtube' });
          return;
        }

        const response = await browser.runtime.sendMessage({
          type: 'GET_VIDEO_DATA',
          tabId: tab.id,
        });

        if (disposed || currentRequest !== requestId) return;

        if (response?.ok && response.data) {
          const data = response.data as VideoData;
          setState((previous) => {
            if (
              previous.status === 'ready' &&
              previous.data.videoId === data.videoId &&
              previous.data.title === data.title &&
              previous.data.thumbnailUrl === data.thumbnailUrl &&
              previous.data.tags.join('|') === data.tags.join('|') &&
              previous.data.description === data.description &&
              metricsKey(previous.data) === metricsKey(data)
            ) {
              return previous;
            }
            return { status: 'ready', data };
          });
        } else if (response?.ok === false) {
          setState({ status: 'error', message: response.error ?? '' });
        } else {
          setState({ status: 'empty' });
        }
      } catch (error) {
        if (!disposed) setState({ status: 'error', message: String(error) });
      }
    }

    function schedule(): void {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refresh();
      }, 250);
    }

    void refresh();

    const onActivated = () => schedule();
    const onUpdated = (_tabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo) => {
      if (changeInfo.status === 'complete' || changeInfo.url) schedule();
    };
    const onFocusChanged = () => schedule();
    const onMessage = (message: unknown) => {
      if (message && typeof message === 'object' && (message as { type?: string }).type === 'VIDEO_CHANGED') {
        schedule();
      }
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows.onFocusChanged.addListener(onFocusChanged);
    browser.runtime.onMessage.addListener(onMessage);

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows.onFocusChanged.removeListener(onFocusChanged);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, [refreshToken]);

  return { state, reload };
}
