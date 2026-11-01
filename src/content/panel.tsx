import { useCallback, useEffect, useState } from 'preact/hooks';
import { copyText } from '../core/clipboard';
import { formatAge, formatCompact, formatViewsPerHour } from '../core/format';
import { t } from '../core/i18n';
import type { SimpleResponse, VideoDataResponse } from '../core/messages';
import { normalizeTags } from '../core/tags';
import type { VideoData } from '../core/types';

let invalidate: (() => void) | null = null;

export function notifyPanelVideoChanged(): void {
  invalidate?.();
}

function LensIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" />
      <path d="M14.6 14.6L19 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M8.4 8.4L12.6 10.5L8.4 12.6Z" fill="currentColor" />
    </svg>
  );
}

function VideoBody({ data }: { data: VideoData }) {
  const [copied, setCopied] = useState(false);
  const tags = normalizeTags(data.tags);

  const stats: Array<{ label: string; value: string }> = [
    {
      label: t('metric.views'),
      value: data.views != null ? formatCompact(data.views) : t('metric.noData'),
    },
    {
      label: t('metric.velocity'),
      value: formatViewsPerHour(data.views, data.publishedAt) ?? t('metric.noData'),
    },
    {
      label: t('metric.published'),
      value: formatAge(data.publishedAt) ?? t('metric.noData'),
    },
  ];

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <div>
        <h3 class="ytpl-title">{data.title || t('metric.noData')}</h3>
        {data.channel && <p class="ytpl-channel">{data.channel}</p>}
      </div>

      <div class="ytpl-stats">
        {stats.map((stat) => (
          <div class="ytpl-stat" key={stat.label}>
            <span class="ytpl-stat-label">{stat.label}</span>
            <span class="ytpl-stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div>
        <h4 class="ytpl-section-title">
          <span>{t('panel.tagsTitle')}</span>
          {tags.length > 0 && (
            <button
              type="button"
              class="ytpl-copy"
              onClick={async () => {
                const ok = await copyText(tags.join(', '));
                if (ok) setCopied(true);
              }}
            >
              {copied ? t('ui.copied') : t('ui.copy')}
            </button>
          )}
        </h4>
        {tags.length === 0 ? (
          <p class="ytpl-empty">{t('tags.empty')}</p>
        ) : (
          <div class="ytpl-tags">
            {tags.map((tag) => (
              <span class="ytpl-tag" key={tag} title={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function PanelRoot() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<VideoData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [openFailed, setOpenFailed] = useState(false);

  const requestSidebar = async () => {
    setOpenFailed(false);
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'OPEN_SIDEBAR',
      })) as SimpleResponse | undefined;
      if (!response?.ok) setOpenFailed(true);
    } catch {
      setOpenFailed(true);
    }
  };

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_VIDEO_DATA',
      })) as VideoDataResponse | undefined;

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
        title={t('panel.buttonTitle')}
        aria-label={t('panel.buttonTitle')}
        aria-expanded={open}
        onClick={toggle}
      >
        <LensIcon />
      </button>

      {open && (
        <section class="ytpl-panel" role="dialog" aria-label={t('panel.title')}>
          <header class="ytpl-head">
            <strong>{t('panel.title')}</strong>
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
            {status === 'loading' && <p class="ytpl-muted">{t('ui.loading')}</p>}
            {status === 'error' && <p class="ytpl-muted">{t('panel.empty')}</p>}
            {status === 'idle' && data && <VideoBody data={data} />}
            {openFailed && <p class="ytpl-hint">{t('panel.openHint')}</p>}
          </div>

          <footer class="ytpl-foot">
            <button type="button" class="ytpl-link" onClick={() => void requestSidebar()}>
              {t('panel.openSidebar')}
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
