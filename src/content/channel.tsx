import { useCallback, useEffect, useState } from 'preact/hooks';
import { render } from 'preact';
import { formatCompact } from '../core/format';
import { t } from '../core/i18n';
import type { ChannelOutliersResponse } from '../core/messages';
import { getSettings } from '../core/settings';
import type { ChannelOutliers } from '../core/types';
import { channelStyles } from './channel-styles';

let invalidate: (() => void) | null = null;

export function notifyChannelChanged(): void {
  invalidate?.();
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M10 19V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M15 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M20 19V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

function badgeClass(outlier: number): string {
  if (outlier >= 2) return 'ytpl-badge is-hot';
  if (outlier >= 1.2) return 'ytpl-badge is-warm';
  return 'ytpl-badge';
}

function OutlierBody({ data }: { data: ChannelOutliers }) {
  return (
    <>
      <div class="ytpl-channel-head">
        <strong>{data.channelName || '—'}</strong>
        <span>
          {t('outliers.median')}: {formatCompact(data.medianViews)}
        </span>
        <span>{t('outliers.sample', [String(data.sampleSize)])}</span>
      </div>

      {data.videos.length === 0 ? (
        <p class="ytpl-muted">{t('outliers.empty')}</p>
      ) : (
        <ol class="ytpl-outlier-list">
          {data.videos.map((video, index) => (
            <li key={video.videoId}>
              <a
                class="ytpl-outlier"
                href={`/watch?v=${video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="ytpl-rank">{index + 1}</span>
                <span class="ytpl-outlier-main">
                  <span class="ytpl-outlier-title">{video.title}</span>
                  <span class="ytpl-outlier-meta">{formatCompact(video.views)}</span>
                </span>
                <span class={badgeClass(video.outlier)}>{video.outlier.toFixed(1)}x</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p class="ytpl-note">{t('outliers.hint')}</p>
    </>
  );
}

export function ChannelPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChannelOutliers | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_CHANNEL_OUTLIERS',
      })) as ChannelOutliersResponse | undefined;

      if (response?.ok && response.data) {
        setData(response.data);
        setStatus('idle');
      } else {
        setData(null);
        setStatus('error');
      }
    } catch {
      setData(null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    invalidate = () => {
      if (open) void load();
    };
    return () => {
      invalidate = null;
    };
  }, [open, load]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  return (
    <>
      <button
        type="button"
        class="ytpl-fab"
        title={t('outliers.fab')}
        aria-label={t('outliers.fab')}
        aria-expanded={open}
        onClick={toggle}
      >
        <ChartIcon />
      </button>

      {open && (
        <section class="ytpl-panel" role="dialog" aria-label={t('outliers.heading')}>
          <header class="ytpl-head">
            <strong>{t('outliers.heading')}</strong>
            <button
              type="button"
              class="ytpl-x"
              aria-label={t('ui.close')}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div class="ytpl-body">
            {status === 'loading' && <p class="ytpl-muted">{t('outliers.loading')}</p>}
            {status === 'error' && <p class="ytpl-muted">{t('outliers.error')}</p>}
            {status === 'idle' && data && <OutlierBody data={data} />}
          </div>

          <footer class="ytpl-foot">
            <button type="button" class="ytpl-link" onClick={() => void load()}>
              {t('outliers.refresh')}
            </button>
            <button type="button" class="ytpl-link" onClick={() => setOpen(false)}>
              {t('ui.close')}
            </button>
          </footer>
        </section>
      )}
    </>
  );
}

let host: HTMLDivElement | null = null;
let mounted = false;
let visible = false;
let lastHref = location.href;

function isChannelPage(): boolean {
  return /^\/(@[^/]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)(\/|$)/.test(
    location.pathname,
  );
}

function ensureMounted(): void {
  if (mounted) return;
  mounted = true;

  host = document.createElement('div');
  host.id = 'ytpl-channel-host';
  host.style.cssText =
    'all:initial;position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483000;';

  const shadow = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(channelStyles);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = channelStyles;
    shadow.appendChild(style);
  }

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.documentElement.appendChild(host);
  render(<ChannelPanel />, mountPoint);
}

async function sync(): Promise<void> {
  const settings = await getSettings();

  if (!settings.showFloatingButton || !isChannelPage()) {
    if (host) host.style.display = 'none';
    visible = false;
    return;
  }

  ensureMounted();
  visible = true;
  if (host) host.style.display = 'block';
}

function onPossibleNavigation(): void {
  if (location.href === lastHref) return;
  lastHref = location.href;
  void sync();
  if (visible) notifyChannelChanged();
}

document.addEventListener('yt-navigate-finish', onPossibleNavigation, true);
window.addEventListener('popstate', onPossibleNavigation);

if (document.head) {
  const headObserver = new MutationObserver(onPossibleNavigation);
  headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
}

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') void sync();
});

void sync();
