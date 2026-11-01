const SUFFIXES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  mil: 1e3,
  m: 1e6,
  million: 1e6,
  millones: 1e6,
  millon: 1e6,
  millón: 1e6,
  b: 1e9,
  billion: 1e9,
};

/**
 * Parses both exact ("619,847 views") and compact ("1.2M views", "114 mil")
 * view counts. The long suffixes are matched before the one-letter ones so
 * "114 mil" is not read as 114 million.
 */
export function parseViewCount(text: string): number {
  if (!text) return 0;

  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const match = normalized.match(
    /(\d[\d.,\s]*)\s*(thousand|million|billion|millones|millón|millon|mil|k|m|b)?/i,
  );
  if (!match) return 0;

  const rawNumber = match[1].replace(/\s/g, '');
  const suffix = (match[2] ?? '').toLocaleLowerCase();

  if (suffix) {
    const number = Number(rawNumber.replace(/,/g, '.'));
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * (SUFFIXES[suffix] ?? 1));
  }

  const digits = rawNumber.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}
