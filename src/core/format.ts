import { t, uiLocale } from './i18n';
import type { CheckResult } from './types';

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(uiLocale(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(uiLocale()).format(value);
  } catch {
    return String(Math.round(value));
  }
}

export function formatAge(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const then = new Date(publishedAt).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return null;
  const minutes = Math.round(diffMs / 60_000);
  try {
    const rtf = new Intl.RelativeTimeFormat(uiLocale(), { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-Math.max(1, minutes), 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 30) return rtf.format(-days, 'day');
    const months = Math.round(days / 30);
    if (months < 12) return rtf.format(-months, 'month');
    return rtf.format(-Math.round(months / 12), 'year');
  } catch {
    return null;
  }
}

export function formatViewsPerHour(views: number | null, publishedAt: string | null): string | null {
  if (views == null || !publishedAt) return null;
  const then = new Date(publishedAt).getTime();
  if (!Number.isFinite(then)) return null;
  const hours = (Date.now() - then) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 1) return null;
  return formatCompact(Math.round(views / hours));
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatCheckValue(check: CheckResult): string {
  switch (check.unit) {
    case 'range':
      return `${Math.round(check.value)}/255`;
    case 'ratio':
      return `${Math.round(check.value * 100)}%`;
    case 'chars':
      return `${Math.round(check.value)} ${t('unit.chars')}`;
    case 'words':
      return `${Math.round(check.value)} ${t('unit.words')}`;
    case 'count':
      return String(Math.round(check.value));
    case 'score':
    default:
      return `${Math.round(check.score)}/100`;
  }
}
