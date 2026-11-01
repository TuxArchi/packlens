import { useCallback, useEffect, useState } from 'preact/hooks';
import { render } from 'preact';
import { auditCsvRows } from '../core/audit';
import type { ChannelAudit } from '../core/audit';
import { downloadText, safeFilename, toCsv } from '../core/download';
import { formatCompact, formatNumber } from '../core/format';
import { t } from '../core/i18n';
import type {
  ChannelAuditResponse,
  ChannelOutliersResponse,
  LicenseResponse,
} from '../core/messages';
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

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(2)}%`;
}

function OutlierBody({
  data,
  onAudit,
}: {
  data: ChannelOutliers;
  onAudit: () => void;
}) {
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

      <div class="ytpl-audit-actions">
        <button type="button" class="ytpl-button" onClick={onAudit}>
          {t('audit.run')}
        </button>
      </div>
      <p class="ytpl-note">{t('audit.freeHint')}</p>
      <p class="ytpl-note">{t('outliers.hint')}</p>
    </>
  );
}

function AuditBody({
  audit,
  isPro,
  onBack,
  onRefresh,
  onExportCsv,
  onExportJson,
  onOpenOptions,
}: {
  audit: ChannelAudit;
  isPro: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onOpenOptions: () => void;
}) {
  return (
    <>
      <div class="ytpl-channel-head">
        <strong>{audit.channelName || '—'}</strong>
        <span>{t('audit.totalVideos', [formatNumber(audit.totalVideos)])}</span>
        <span>
          {t('audit.median')}: {formatCompact(audit.medianViews)}
        </span>
        <span>
          {t('audit.average')}: {formatCompact(audit.averageViews)}
        </span>
        <span>
          {t('audit.totalViews')}: {formatCompact(audit.totalViews)}
        </span>
      </div>

      {audit.unitsUsed > 0 && (
        <p class="ytpl-note">{t('audit.units', [String(audit.unitsUsed)])}</p>
      )}
      {audit.truncated && (
        <p class="ytpl-note">
          {t('audit.truncated', [String(audit.totalVideos)])}
        </p>
      )}

      <div class="ytpl-audit-actions">
        {isPro ? (
          <>
            <button type="button" class="ytpl-button" onClick={onExportCsv}>
              {t('export.csv')}
            </button>
            <button type="button" class="ytpl-button" onClick={onExportJson}>
              {t('export.json')}
            </button>
          </>
        ) : (
          <button type="button" class="ytpl-button" onClick={onOpenOptions}>
            {t('export.unlock')}
          </button>
        )}
        <button type="button" class="ytpl-link" onClick={onRefresh}>
          {t('audit.refresh')}
        </button>
        <button type="button" class="ytpl-link" onClick={onBack}>
          {t('audit.back')}
        </button>
      </div>

      {!isPro && <p class="ytpl-note">{t('export.locked')}</p>}

      <div class="ytpl-audit-section">
        <strong>{t('audit.top')}</strong>
        <ol class="ytpl-outlier-list">
          {audit.topOutliers.map((video, index) => (
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
                  <span class="ytpl-outlier-meta">
                    {formatCompact(video.views)} · {formatPercent(video.engagementRate)}
                  </span>
                </span>
                <span class={badgeClass(video.outlier)}>{video.outlier.toFixed(1)}x</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div class="ytpl-audit-section">
        <strong>{t('audit.bottom')}</strong>
        <ol class="ytpl-outlier-list">
          {audit.bottomVideos.map((video, index) => (
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
                  <span class="ytpl-outlier-meta">
                    {formatCompact(video.views)} · {formatPercent(video.engagementRate)}
                  </span>
                </span>
                <span class={badgeClass(video.outlier)}>{video.outlier.toFixed(1)}x</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <details class="ytpl-audit-all">
        <summary>{t('audit.all', [String(audit.totalVideos)])}</summary>
        <ol class="ytpl-outlier-list">
          {audit.videos.map((video, index) => (
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
                  <span class="ytpl-outlier-meta">
                    {formatCompact(video.views)} · {formatPercent(video.engagementRate)}
                  </span>
                </span>
                <span class={badgeClass(video.outlier)}>{video.outlier.toFixed(1)}x</span>
              </a>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

function auditErrorText(code: string | null): string {
  if (code === 'no-key') return t('audit.errorNoKey');
  if (code === 'quota') return t('audit.errorQuota');
  return t('audit.error');
}

export function ChannelPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChannelOutliers | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [audit, setAudit] = useState<ChannelAudit | null>(null);
  const [auditStatus, setAuditStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    void browser.runtime
      .sendMessage({ type: 'GET_LICENSE' })
      .then((response: LicenseResponse | undefined) => {
        if (response?.ok && response.data) setIsPro(response.data.isPro);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setAudit(null);
    setAuditStatus('idle');
    setAuditError(null);
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

  const loadAudit = useCallback(async () => {
    if (!data?.channelId) {
      setAuditStatus('error');
      setAuditError('no-channel');
      return;
    }

    setAuditStatus('loading');
    setAuditError(null);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_CHANNEL_AUDIT',
        channelId: data.channelId,
      })) as ChannelAuditResponse | undefined;

      if (response?.ok && response.data) {
        setAudit(response.data);
        setAuditStatus('idle');
      } else {
        setAudit(null);
        setAuditError(response?.code ?? 'api');
        setAuditStatus('error');
      }
    } catch {
      setAudit(null);
      setAuditError('api');
      setAuditStatus('error');
    }
  }, [data?.channelId]);

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

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const exportAuditCsv = () => {
    if (!audit) return;
    downloadText(
      `packlens-audit-${safeFilename(audit.channelName, 'channel')}.csv`,
      toCsv(auditCsvRows(audit)),
      'text/csv;charset=utf-8',
    );
  };

  const exportAuditJson = () => {
    if (!audit) return;
    downloadText(
      `packlens-audit-${safeFilename(audit.channelName, 'channel')}.json`,
      JSON.stringify({ ...audit, exportedAt: new Date().toISOString() }, null, 2),
      'application/json',
    );
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
            {status === 'idle' && data && !audit && auditStatus !== 'loading' && (
              <OutlierBody data={data} onAudit={() => void loadAudit()} />
            )}
            {auditStatus === 'loading' && (
              <p class="ytpl-muted">{t('audit.loading')}</p>
            )}
            {auditStatus === 'error' && (
              <p class="ytpl-muted">{auditErrorText(auditError)}</p>
            )}
            {audit && (
              <AuditBody
                audit={audit}
                isPro={isPro}
                onBack={() => setAudit(null)}
                onRefresh={() => void loadAudit()}
                onExportCsv={exportAuditCsv}
                onExportJson={exportAuditJson}
                onOpenOptions={openOptions}
              />
            )}
          </div>

          <footer class="ytpl-foot">
            <button
              type="button"
              class="ytpl-link"
              onClick={() => (audit ? void loadAudit() : void load())}
            >
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
