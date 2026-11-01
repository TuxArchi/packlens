import { useEffect, useState } from 'preact/hooks';
import { entitlementsFromSnapshot } from '../core/entitlements';
import { computeThumbMetrics } from '../core/image-metrics';
import { t } from '../core/i18n';
import { LICENSE_STORAGE_KEY } from '../core/license';
import type { LicenseSnapshot } from '../core/license';
import type { LicenseResponse } from '../core/messages';
import { analyzePackaging } from '../core/packaging';
import type { PackagingReport } from '../core/packaging';
import { loadThumbnail } from '../core/thumbnail';
import { useActiveVideo } from './useActiveVideo';
import { CheckList } from './components/Checks';
import { KeywordPanel } from './components/KeywordPanel';
import { PerformancePanel } from './components/PerformancePanel';
import { ScoreRing } from './components/ScoreRing';
import { SeoPanel } from './components/SeoPanel';
import { TagsPanel } from './components/TagsPanel';
import { VideoCard } from './components/VideoCard';

type Tab = 'packaging' | 'tags' | 'seo' | 'keywords' | 'performance';

const reportCache = new Map<string, PackagingReport>();

function EmptyState({ kind }: { kind: 'not-youtube' | 'empty' | 'error' }) {
  const title =
    kind === 'not-youtube'
      ? t('state.notYoutubeTitle')
      : kind === 'error'
        ? t('state.errorTitle')
        : t('state.emptyTitle');

  const body =
    kind === 'not-youtube'
      ? t('state.notYoutubeBody')
      : kind === 'error'
        ? t('state.errorBody')
        : t('state.emptyBody');

  return (
    <section class="empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function PackagingView({
  report,
  thumbMissing,
}: {
  report: PackagingReport;
  thumbMissing: boolean;
}) {
  return (
    <>
      <section class="card score-card">
        <ScoreRing score={report.score} />
        <div class="score-copy">
          <p class="verdict">{t(`score.${scoreVerdict(report.score)}`)}</p>
          <p class="muted">{t('packaging.disclaimer')}</p>
        </div>
      </section>

      {thumbMissing && <p class="notice">{t('state.thumbFailed')}</p>}

      {report.thumbnail && (
        <section class="block">
          <h3 class="section-title">
            {t('packaging.thumbnail')}
            <span class="section-score">{Math.round(report.thumbnail.score)}/100</span>
          </h3>
          <CheckList checks={report.thumbnail.checks} />
        </section>
      )}

      <section class="block">
        <h3 class="section-title">
          {t('packaging.title')}
          <span class="section-score">{Math.round(report.title.score)}/100</span>
        </h3>
        <CheckList checks={report.title.checks} />
      </section>
    </>
  );
}

function scoreVerdict(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function App() {
  const { state: view, reload } = useActiveVideo();
  const [tab, setTab] = useState<Tab>('packaging');
  const [report, setReport] = useState<PackagingReport | null>(null);
  const [thumbMissing, setThumbMissing] = useState(false);
  const [license, setLicense] = useState<LicenseSnapshot | null>(null);

  useEffect(() => {
    try {
      const mode = new URLSearchParams(location.search).get('mode');
      if (mode !== 'window') {
        void browser.runtime
          .sendMessage({ type: 'SIDEBAR_OPENED' })
          .catch(() => undefined);
      }
    } catch {
      // Ignore malformed extension URLs.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void browser.runtime
        .sendMessage({ type: 'GET_LICENSE' })
        .then((response: LicenseResponse | undefined) => {
          if (!cancelled && response?.ok && response.data) {
            setLicense(response.data);
          }
        })
        .catch(() => undefined);
    };

    load();

    const onChanged = (
      changes: { [key: string]: browser.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && changes[LICENSE_STORAGE_KEY]) load();
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const data = view.status === 'ready' ? view.data : null;
  const entitlements = entitlementsFromSnapshot(license);
  const metricsKey = data?.thumbnailMetrics
    ? `${Math.round(data.thumbnailMetrics.tonalRange)}:${Math.round(
        data.thumbnailMetrics.edgeDensity * 1000,
      )}`
    : '';
  const cacheKey = data
    ? `${data.videoId ?? ''}::${data.title}::${data.thumbnailUrl ?? ''}::${metricsKey}`
    : '';

  useEffect(() => {
    if (!data) {
      setReport(null);
      setThumbMissing(false);
      return;
    }

    const cached = reportCache.get(cacheKey);
    if (cached) {
      setReport(cached);
      setThumbMissing(cached.partial);
      return;
    }

    let cancelled = false;
    setReport(null);
    setThumbMissing(false);

    void (async () => {
      let metrics: ReturnType<typeof computeThumbMetrics> | null =
        data.thumbnailMetrics ?? null;

      if (!metrics) {
        const pixels = await loadThumbnail(
          data.source === 'studio' ? null : data.videoId,
          data.thumbnailUrl,
        );
        if (cancelled) return;
        if (pixels) metrics = computeThumbMetrics(pixels);
      }

      if (!metrics && data.thumbnailFallbackUrl) {
        const fallbackPixels = await loadThumbnail(null, data.thumbnailFallbackUrl);
        if (cancelled) return;
        if (fallbackPixels) metrics = computeThumbMetrics(fallbackPixels);
      }

      if (cancelled) return;
      const result = analyzePackaging(data.title, metrics);

      reportCache.set(cacheKey, result);
      if (reportCache.size > 60) {
        const oldest = reportCache.keys().next().value;
        if (oldest) reportCache.delete(oldest);
      }

      setThumbMissing(!metrics);
      setReport(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, data]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'packaging', label: t('ui.tabPackaging') },
    { id: 'tags', label: t('ui.tabTags') },
    { id: 'seo', label: t('ui.tabSeo') },
    { id: 'keywords', label: t('ui.tabKeywords') },
    { id: 'performance', label: t('ui.tabPerformance') },
  ];

  const emptyKind: 'not-youtube' | 'empty' | 'error' =
    view.status === 'not-youtube'
      ? 'not-youtube'
      : view.status === 'error'
        ? 'error'
        : 'empty';

  const videoFallback =
    view.status === 'loading' ? (
      <p class="muted">{t('ui.loading')}</p>
    ) : (
      <EmptyState kind={emptyKind} />
    );

  const useKeyword = (keyword: string) => {
    if (data?.videoId) {
      void browser.storage.local
        .set({ [`seo-keyword:${data.videoId}`]: keyword })
        .catch(() => undefined)
        .finally(() => setTab('seo'));
    } else {
      setTab('seo');
    }
  };

  const expandStudioTags = async () => {
    try {
      await browser.runtime.sendMessage({ type: 'EXPAND_STUDIO_TAGS' });
    } catch {
      // Ignore; reload still refreshes whatever is available.
    }
    reload();
  };

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            ◎
          </span>
          <span class="brand-name">{t('extName')}</span>
          {license && (
            <span
              class={`plan-badge ${entitlements.isPro ? 'is-pro' : 'is-free'}`}
              title={license.variantName ?? t('license.planFree')}
            >
              {entitlements.isPro ? t('license.planPro') : t('license.planFree')}
            </span>
          )}
        </div>
        <button
          type="button"
          class="icon-button"
          title={t('ui.settings')}
          aria-label={t('ui.settings')}
          onClick={() => {
            void browser.runtime.openOptionsPage();
          }}
        >
          ⚙
        </button>
      </header>

      <main class="content">
        {data && <VideoCard data={data} />}

        <nav class="tabs" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              class="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'packaging' &&
          (data ? (
            report ? (
              <PackagingView report={report} thumbMissing={thumbMissing} />
            ) : (
              <p class="muted">{t('ui.loading')}</p>
            )
          ) : (
            videoFallback
          ))}

        {tab === 'tags' &&
          (data ? (
            <TagsPanel
              tags={data.tags}
              source={data.source}
              onRetry={() => void expandStudioTags()}
            />
          ) : (
            videoFallback
          ))}

        {tab === 'seo' &&
          (data ? <SeoPanel data={data} /> : videoFallback)}

        {tab === 'keywords' && (
          <KeywordPanel
            video={data}
            onUseKeyword={useKeyword}
            onApplied={reload}
            isPro={entitlements.isPro}
          />
        )}

        {tab === 'performance' &&
          (data ? (
            <PerformancePanel video={data} isPro={entitlements.isPro} />
          ) : (
            videoFallback
          ))}
      </main>
    </div>
  );
}
