import { useEffect, useMemo, useState } from 'preact/hooks';
import { findCsvRow, parseStudioCsv } from '../../core/csv';
import type { CsvReport, CsvVideoRow } from '../../core/csv';
import { formatCompact, formatDuration, formatNumber } from '../../core/format';
import { t } from '../../core/i18n';
import type { PerformanceResponse } from '../../core/messages';
import {
  analyzePerformance,
  loadPerformanceSnapshot,
  makePerformanceSnapshot,
  savePerformanceSnapshot,
} from '../../core/performance';
import type {
  PerformanceReview,
  PerformanceSnapshot,
  PerformanceStats,
} from '../../core/performance';
import { detectKeyword } from '../../core/seo';
import type { VideoData } from '../../core/types';

interface Props {
  video: VideoData | null;
  isPro: boolean;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div class="performance-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRatio(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}×`;
}

function formatPercent(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
}

function formatSeconds(value: number | null): string {
  return formatDuration(value) ?? '—';
}

function reviewItems(
  items: PerformanceReview['strengths'],
  prefix: string,
): string[] {
  return items.map((item) => t(`${prefix}.${item.code}`));
}

export function PerformancePanel({ video, isPro }: Props) {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [csvReport, setCsvReport] = useState<CsvReport | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    if (!video?.videoId) {
      setStats(null);
      return;
    }

    let cancelled = false;
    void browser.runtime
      .sendMessage({
        type: 'GET_PERFORMANCE',
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
        views: video.views,
        channelId: video.channelId ?? null,
      })
      .then((response: PerformanceResponse | undefined) => {
        if (!cancelled && response?.ok && response.data) {
          setStats(response.data);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    video?.videoId,
    video?.title,
    video?.publishedAt,
    video?.views,
    video?.channelId,
  ]);

  useEffect(() => {
    if (!video?.videoId) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    void loadPerformanceSnapshot(video.videoId).then((existing) => {
      if (cancelled) return;
      if (existing) {
        setSnapshot(existing);
        return;
      }

      const created = makePerformanceSnapshot(
        {
          videoId: video.videoId as string,
          title: video.title,
          description: video.description,
          tags: video.tags,
          publishedAt: video.publishedAt,
          views: video.views,
          now: Date.now(),
        },
        stats,
      );
      setSnapshot(created);
      void savePerformanceSnapshot(created);
    });

    return () => {
      cancelled = true;
    };
  }, [video?.videoId, stats?.views, stats?.likes, stats?.comments]);

  const review = useMemo(() => {
    if (!video?.videoId) return null;
    return analyzePerformance({
      videoId: video.videoId,
      title: video.title,
      description: video.description,
      tags: video.tags,
      publishedAt: video.publishedAt,
      views: video.views,
      keyword: detectKeyword(video.title, video.tags).keyword,
      stats,
      snapshot,
      now: Date.now(),
    });
  }, [video, stats, snapshot]);

  const csvRow = useMemo(
    () => (csvReport && video ? findCsvRow(csvReport, video.videoId, video.title) : null),
    [csvReport, video],
  );

  const topCsvRows = useMemo(() => {
    if (!csvReport) return [];
    return [...csvReport.rows]
      .filter((row) => row.views != null)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 5);
  }, [csvReport]);

  if (!video) {
    return (
      <section class="empty">
        <h2>{t('performance.noVideoTitle')}</h2>
        <p>{t('performance.noVideoBody')}</p>
      </section>
    );
  }

  const loadCsv = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setCsvError(null);
    setCsvReport(null);
    setCsvName(null);

    if (file.name.toLocaleLowerCase().endsWith('.zip')) {
      setCsvError(t('performance.csv.zip'));
      input.value = '';
      return;
    }

    try {
      const text = await file.text();
      const report = parseStudioCsv(text);
      if (report.rows.length === 0) {
        setCsvError(t('performance.csv.error'));
        return;
      }
      setCsvReport(report);
      setCsvName(file.name);
    } catch {
      setCsvError(t('performance.csv.error'));
    } finally {
      input.value = '';
    }
  };

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  return (
    <div class="performance">
      <section class="card performance-review">
        <div class="performance-head">
          <div>
            <h3 class="section-title">{t('performance.heading')}</h3>
            <p class="muted">{t('performance.intro')}</p>
          </div>
          <span class={`plan-badge ${isPro ? 'is-pro' : 'is-free'}`}>
            {isPro ? t('license.planPro') : t('license.planFree')}
          </span>
        </div>

        {review && !review.eligible && (
          <>
            <div class="performance-verdict is-pending">
              <strong>{t('performance.verdict.pending')}</strong>
              <span>
                {t('performance.pending', [
                  String(Math.max(0, Math.ceil(48 - review.ageHours))),
                ])}
              </span>
            </div>
            <PerformanceMetrics review={review} />
            <p class="hint">{t('performance.pendingHint')}</p>
          </>
        )}

        {review && review.eligible && (
          <>
            <div class={`performance-verdict is-${review.verdict}`}>
              <strong>{t(`performance.verdict.${review.verdict}`)}</strong>
              <span>{t('performance.ratio', [formatRatio(review.ratio)])}</span>
            </div>

            <PerformanceMetrics review={review} />

            {review.strengths.length > 0 && (
              <div class="performance-list">
                <h4 class="kw-sublabel">{t('performance.strengths')}</h4>
                <ul>
                  {reviewItems(review.strengths, 'performance.strength').map(
                    (item) => (
                      <li key={item}>{item}</li>
                    ),
                  )}
                </ul>
              </div>
            )}

            {review.improvements.length > 0 && (
              <div class="performance-list">
                <h4 class="kw-sublabel">{t('performance.improvements')}</h4>
                <ul>
                  {review.improvements.map((item) => (
                    <li key={item.code}>
                      {t(`performance.improvement.${item.code}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {review.changes.length > 0 && (
              <p class="hint">
                {t('performance.changes')}:{' '}
                {review.changes
                  .map((change) => t(`performance.change.${change}`))
                  .join(' · ')}
              </p>
            )}

            <p class="hint">{t('performance.disclaimer')}</p>
          </>
        )}

        {review?.stats.partial && (
          <p class="hint">{t('performance.partial')}</p>
        )}
      </section>

      <section class="card performance-csv">
        <div class="performance-head">
          <div>
            <h3 class="section-title">{t('performance.csv.title')}</h3>
            <p class="muted">{t('performance.csv.hint')}</p>
          </div>
          <span class={`plan-badge ${isPro ? 'is-pro' : 'is-free'}`}>
            {isPro ? t('license.planPro') : t('license.planFree')}
          </span>
        </div>

        {isPro ? (
          <>
            <input
              class="input performance-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void loadCsv(event)}
            />

            {csvError && <p class="notice">{csvError}</p>}

            {csvReport && (
              <>
                <p class="performance-csv-summary">
                  {t('performance.csv.loaded', [
                    String(csvReport.rows.length),
                    formatPercent(csvReport.medians.ctr),
                  ])}
                  {csvName ? ` · ${csvName}` : ''}
                </p>

                {csvRow ? (
                  <CsvMetrics row={csvRow} report={csvReport} />
                ) : (
                  <p class="notice">{t('performance.csv.noMatch')}</p>
                )}

                {topCsvRows.length > 0 && (
                  <div class="performance-table-wrap">
                    <h4 class="kw-sublabel">{t('performance.csv.top')}</h4>
                    <table class="performance-table">
                      <thead>
                        <tr>
                          <th>{t('performance.csv.colTitle')}</th>
                          <th>{t('performance.csv.colViews')}</th>
                          <th>{t('performance.csv.colCtr')}</th>
                          <th>{t('performance.csv.colAvd')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCsvRows.map((row) => (
                          <tr key={`${row.videoId}-${row.title}`}>
                            <td title={row.title}>{row.title || row.videoId}</td>
                            <td>{row.views == null ? '—' : formatCompact(row.views)}</td>
                            <td>{formatPercent(row.ctr)}</td>
                            <td>{formatSeconds(row.avdSeconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p class="muted">{t('performance.csv.locked')}</p>
            <button type="button" class="button" onClick={openOptions}>
              {t('performance.csv.unlock')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function PerformanceMetrics({ review }: { review: PerformanceReview }) {
  const baselineLabel =
    review.stats.baselineUnit === 'per-day'
      ? t('performance.channelMedianPerDay')
      : t('performance.channelMedian');

  return (
    <div class="performance-metrics">
      <Metric
        label={t('performance.views')}
        value={review.stats.views == null ? '—' : formatCompact(review.stats.views)}
      />
      <Metric
        label={t('performance.viewsPerDay')}
        value={review.viewsPerDay == null ? '—' : formatCompact(review.viewsPerDay)}
      />
      <Metric
        label={baselineLabel}
        value={
          review.stats.baselineUnit === 'per-day'
            ? review.stats.channelMedianViewsPerDay == null
              ? '—'
              : formatCompact(review.stats.channelMedianViewsPerDay)
            : review.stats.channelMedianViews == null
              ? '—'
              : formatCompact(review.stats.channelMedianViews)
        }
      />
      <Metric
        label={t('performance.engagement')}
        value={formatPercent(
          review.engagementRate == null ? null : review.engagementRate * 100,
        )}
      />
      <Metric
        label={t('performance.likes')}
        value={review.stats.likes == null ? '—' : formatCompact(review.stats.likes)}
      />
      <Metric
        label={t('performance.comments')}
        value={
          review.stats.comments == null ? '—' : formatCompact(review.stats.comments)
        }
      />
    </div>
  );
}

function CsvMetrics({ row, report }: { row: CsvVideoRow; report: CsvReport }) {
  return (
    <div class="performance-csv-row">
      <div class="performance-metrics">
        <Metric
          label={t('performance.csv.views')}
          value={row.views == null ? '—' : formatNumber(row.views)}
        />
        <Metric
          label={t('performance.csv.impressions')}
          value={row.impressions == null ? '—' : formatNumber(row.impressions)}
        />
        <Metric label={t('performance.csv.ctr')} value={formatPercent(row.ctr)} />
        <Metric label={t('performance.csv.avd')} value={formatSeconds(row.avdSeconds)} />
        <Metric
          label={t('performance.csv.avgViewed')}
          value={formatPercent(row.averagePercentViewed)}
        />
      </div>

      <p class="hint">
        {t('performance.csv.vsMedian', [
          formatPercent(report.medians.ctr),
          formatSeconds(report.medians.avdSeconds),
          formatPercent(report.medians.averagePercentViewed),
        ])}
      </p>
    </div>
  );
}
