import type { CheckResult } from './types';

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function statusForScore(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 75) return 'good';
  if (score >= 45) return 'warn';
  return 'bad';
}

export function verdictKey(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function weightedScore(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = checks.reduce((sum, check) => sum + check.score * check.weight, 0);
  return weighted / totalWeight;
}
