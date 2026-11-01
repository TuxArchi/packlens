import { fold } from './seo';

export interface CsvVideoRow {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number | null;
  views: number | null;
  watchTimeHours: number | null;
  subscribers: number | null;
  revenue: number | null;
  impressions: number | null;
  ctr: number | null;
  avdSeconds: number | null;
  averagePercentViewed: number | null;
}

export interface CsvMedians {
  views: number | null;
  ctr: number | null;
  avdSeconds: number | null;
  averagePercentViewed: number | null;
  impressions: number | null;
}

export interface CsvReport {
  rows: CsvVideoRow[];
  total: CsvVideoRow | null;
  medians: CsvMedians;
  delimiter: string;
  headers: string[];
}

type NumberKind = 'integer' | 'decimal';

type Field =
  | 'videoId'
  | 'title'
  | 'publishedAt'
  | 'duration'
  | 'views'
  | 'watchTime'
  | 'subscribers'
  | 'revenue'
  | 'impressions'
  | 'ctr'
  | 'avd'
  | 'avgViewed';

const HEADER_CANDIDATES: Record<Field, string[]> = {
  videoId: ['content', 'video id', 'id del video', 'contenido', 'id de contenido'],
  title: ['video title', 'titulo del video', 'titulo', 'video'],
  publishedAt: [
    'video publish time',
    'fecha de publicacion del video',
    'fecha de publicacion',
  ],
  duration: ['duration', 'duracion'],
  views: ['views', 'vistas'],
  watchTime: [
    'watch time hours',
    'tiempo de visualizacion horas',
    'tiempo de visualizacion',
  ],
  subscribers: ['subscribers', 'suscriptores'],
  revenue: [
    'estimated revenue usd',
    'ingresos estimados usd',
    'ingresos estimados',
  ],
  impressions: ['thumbnail impressions', 'impresiones de miniatura'],
  ctr: [
    'thumbnail click through rate',
    'porcentaje de clics en miniaturas',
    'porcentaje de clics',
  ],
  avd: [
    'average view duration',
    'duracion media de visualizacion',
    'duracion media',
  ],
  avgViewed: [
    'average percentage viewed',
    'porcentaje medio visto',
  ],
};

export function parseStudioCsv(text: string): CsvReport {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsvRows(source, delimiter);
  const headerIndex = findHeaderRow(rows);
  const headers = rows[headerIndex] ?? [];
  const normalizedHeaders = headers.map(normalizeHeader);
  const indexes = {} as Record<Field, number>;
  for (const field of Object.keys(HEADER_CANDIDATES) as Field[]) {
    indexes[field] = findHeader(normalizedHeaders, HEADER_CANDIDATES[field]);
  }

  const videos: CsvVideoRow[] = [];
  let total: CsvVideoRow | null = null;

  for (const cells of rows.slice(headerIndex + 1)) {
    const videoId = cell(cells, indexes.videoId);
    const title = cell(cells, indexes.title);
    if (!videoId && !title) continue;

    const parsed = parseRow(cells, indexes, videoId, title);
    if (/^(total|totales|total general)$/i.test(videoId) || /^total$/i.test(title)) {
      total = parsed;
      continue;
    }

    if (!parsed.videoId && !parsed.title) continue;
    videos.push(parsed);
  }

  return {
    rows: videos,
    total,
    medians: {
      views: median(videos.map((row) => row.views).filter(isPositive)),
      ctr: median(videos.map((row) => row.ctr).filter(isNumber)),
      avdSeconds: median(videos.map((row) => row.avdSeconds).filter(isNumber)),
      averagePercentViewed: median(
        videos.map((row) => row.averagePercentViewed).filter(isNumber),
      ),
      impressions: median(
        videos.map((row) => row.impressions).filter(isPositive),
      ),
    },
    delimiter,
    headers,
  };
}

export function findCsvRow(
  report: CsvReport,
  videoId?: string | null,
  title?: string | null,
): CsvVideoRow | null {
  if (videoId) {
    const match = report.rows.find(
      (row) => row.videoId.toLocaleLowerCase() === videoId.toLocaleLowerCase(),
    );
    if (match) return match;
  }

  if (title) {
    const folded = fold(title);
    return report.rows.find((row) => fold(row.title) === folded) ?? null;
  }

  return null;
}

function parseRow(
  cells: string[],
  indexes: Record<Field, number>,
  videoId: string,
  title: string,
): CsvVideoRow {
  const durationSeconds = parseDuration(cell(cells, indexes.duration));
  const views = parseNumber(cell(cells, indexes.views), 'integer');
  const watchTimeHours = parseNumber(cell(cells, indexes.watchTime), 'decimal');
  const explicitAvd = parseNumber(cell(cells, indexes.avd), 'decimal');
  const explicitAvgViewed = parseNumber(cell(cells, indexes.avgViewed), 'decimal');

  let avdSeconds = explicitAvd;
  if (avdSeconds == null && watchTimeHours != null && views != null && views > 0) {
    avdSeconds = (watchTimeHours * 3600) / views;
  }

  let averagePercentViewed = explicitAvgViewed;
  if (
    averagePercentViewed == null &&
    avdSeconds != null &&
    durationSeconds != null &&
    durationSeconds > 0
  ) {
    averagePercentViewed = (avdSeconds / durationSeconds) * 100;
  }

  return {
    videoId,
    title,
    publishedAt: cell(cells, indexes.publishedAt),
    durationSeconds,
    views,
    watchTimeHours,
    subscribers: parseNumber(cell(cells, indexes.subscribers), 'integer'),
    revenue: parseNumber(cell(cells, indexes.revenue), 'decimal'),
    impressions: parseNumber(cell(cells, indexes.impressions), 'integer'),
    ctr: parseNumber(cell(cells, indexes.ctr), 'decimal'),
    avdSeconds,
    averagePercentViewed,
  };
}

function detectDelimiter(firstLine: string): string {
  let comma = 0;
  let semicolon = 0;
  let tab = 0;
  let inQuotes = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      if (inQuotes && firstLine[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === ',') comma += 1;
    else if (char === ';') semicolon += 1;
    else if (char === '\t') tab += 1;
  }

  if (semicolon > comma && semicolon >= tab) return ';';
  if (tab > comma && tab > semicolon) return '\t';
  return ',';
}

function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // Handled by the following \n.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim().length > 0));
}

function findHeaderRow(rows: string[][]): number {
  const index = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.some((header) => header === 'views' || header === 'vistas') &&
      headers.some(
        (header) =>
          header === 'content' ||
          header === 'video title' ||
          header === 'titulo del video',
      )
    );
  });
  return index >= 0 ? index : 0;
}

function findHeader(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const exact = headers.indexOf(candidate);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const partial = headers.findIndex((header) => header.includes(candidate));
    if (partial >= 0) return partial;
  }
  return -1;
}

function normalizeHeader(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cell(cells: string[], index: number): string {
  return index >= 0 ? (cells[index] ?? '').trim() : '';
}

function parseNumber(raw: string, kind: NumberKind): number | null {
  let value = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!value) return null;

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  if (hasComma && hasDot) {
    if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
      value = value.replace(/\./g, '').replace(',', '.');
    } else {
      value = value.replace(/,/g, '');
    }
  } else if (hasComma) {
    if (kind === 'integer' || /,\d{3}$/.test(value)) {
      value = value.replace(/,/g, '');
    } else {
      value = value.replace(',', '.');
    }
  } else if (hasDot && kind === 'integer' && /\.\d{3}$/.test(value)) {
    value = value.replace(/\./g, '');
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return kind === 'integer' ? Math.round(parsed) : parsed;
}

function parseDuration(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.includes(':')) {
    const parts = value.split(':').map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  return parseNumber(value, 'integer');
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: number | null): value is number {
  return isNumber(value) && value > 0;
}
