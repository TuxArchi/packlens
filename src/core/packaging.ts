import type { ThumbMetrics } from './image-metrics';
import { clamp, statusForScore, weightedScore } from './score';
import { analyzeTitle } from './title-score';
import type { CheckResult } from './types';

const THUMBNAIL_WEIGHT = 0.65;
const TITLE_WEIGHT = 0.35;

export interface ThumbReport {
  score: number;
  checks: CheckResult[];
}

export interface TitleReport {
  score: number;
  checks: CheckResult[];
}

export interface PackagingReport {
  score: number;
  thumbnail: ThumbReport | null;
  title: TitleReport;
  partial: boolean;
}

function makeCheck(
  id: string,
  weight: number,
  score: number,
  value: number,
  unit: CheckResult['unit'],
): CheckResult {
  const normalised = clamp(score, 0, 100);
  return {
    id,
    weight,
    score: normalised,
    status: statusForScore(normalised),
    value,
    unit,
  };
}

function scoreTonalRange(range: number): number {
  return clamp(((range - 40) / 140) * 100, 0, 100);
}

function scoreEdgeDensity(density: number): number {
  if (density < 0.03) return 15;
  if (density < 0.07) return 15 + ((density - 0.03) / 0.04) * 85;
  if (density <= 0.24) return 100;
  if (density <= 0.45) return 100 - ((density - 0.24) / 0.21) * 85;
  return 15;
}

function scoreColorfulness(colorfulness: number): number {
  return clamp((colorfulness / 80) * 100, 0, 100);
}

function scoreMobileRetention(retention: number): number {
  return clamp(((retention - 0.45) / 0.4) * 100, 0, 100);
}

export function analyzeThumbnail(metrics: ThumbMetrics): ThumbReport {
  const checks: CheckResult[] = [
    makeCheck('tonalRange', 25, scoreTonalRange(metrics.tonalRange), metrics.tonalRange, 'range'),
    makeCheck('edgeDensity', 25, scoreEdgeDensity(metrics.edgeDensity), metrics.edgeDensity, 'ratio'),
    makeCheck(
      'colorfulness',
      20,
      scoreColorfulness(metrics.colorfulness),
      metrics.colorfulness,
      'score',
    ),
    makeCheck(
      'mobileLegibility',
      30,
      scoreMobileRetention(metrics.mobileRetention),
      metrics.mobileRetention,
      'ratio',
    ),
  ];

  return { score: weightedScore(checks), checks };
}

export function analyzePackaging(title: string, metrics: ThumbMetrics | null): PackagingReport {
  const titleReport = analyzeTitle(title);
  const thumbnail = metrics ? analyzeThumbnail(metrics) : null;

  const score = thumbnail
    ? thumbnail.score * THUMBNAIL_WEIGHT + titleReport.score * TITLE_WEIGHT
    : titleReport.score;

  return {
    score: Math.round(score),
    thumbnail,
    title: titleReport,
    partial: !thumbnail,
  };
}
