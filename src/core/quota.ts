import type { QuotaState } from './types';

export const SEARCH_LIMIT = 100;
export const UNIT_LIMIT = 10_000;
const STORAGE_KEY = 'quota';

interface QuotaRecord {
  date: string;
  searches: number;
  units: number;
}

/**
 * Google resets the YouTube Data API quota at midnight Pacific Time, so the
 * local counter must use the same day boundary.
 */
export function todayPT(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function readRecord(): Promise<QuotaRecord> {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const record = stored[STORAGE_KEY] as Partial<QuotaRecord> | undefined;
    if (
      record &&
      record.date === todayPT() &&
      typeof record.searches === 'number' &&
      typeof record.units === 'number'
    ) {
      return {
        date: record.date,
        searches: Math.max(0, record.searches),
        units: Math.max(0, record.units),
      };
    }
  } catch {
    // Fall through to a fresh record.
  }
  return { date: todayPT(), searches: 0, units: 0 };
}

async function writeRecord(record: QuotaRecord): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: record });
}

export async function getQuota(): Promise<QuotaState> {
  const record = await readRecord();
  const searchesLeft = Math.max(0, SEARCH_LIMIT - record.searches);
  const unitsLeft = Math.max(0, UNIT_LIMIT - record.units);

  return {
    date: record.date,
    searchesUsed: record.searches,
    searchLimit: SEARCH_LIMIT,
    searchesLeft,
    unitsUsed: record.units,
    unitLimit: UNIT_LIMIT,
    unitsLeft,
  };
}

export async function addSearch(): Promise<void> {
  const record = await readRecord();
  await writeRecord({
    date: todayPT(),
    searches: record.searches + 1,
    units: record.units,
  });
}

export async function addUnits(units: number): Promise<void> {
  const record = await readRecord();
  await writeRecord({
    date: todayPT(),
    searches: record.searches,
    units: record.units + Math.max(0, units),
  });
}

/** A search needs one search-list call and two unit-priced detail calls. */
export function canSearch(quota: QuotaState): boolean {
  return quota.searchesLeft > 0 && quota.unitsLeft >= 2;
}
