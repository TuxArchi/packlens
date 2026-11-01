import { describe, expect, it } from 'vitest';
import { findCsvRow, parseStudioCsv } from '../src/core/csv';

const ENGLISH_CSV = `Content,Video title,Video publish time,Duration,Views,Watch time (hours),Subscribers,Estimated revenue (USD),Thumbnail impressions,Thumbnail click-through rate (%)
Total,,,,129118,2738.2749,275,56.223,328807,8.64
IVgYzK-3tKA,"Zelda, PC",Oct 24 2026,633,28398,404.9823,24,7.62,58749,10.61
XegTYBBT4PY,OpenCode,Oct 27 2026,774,16579,375.9098,102,7.689,50424,6.3
,,,,,,,,
`;

const SPANISH_CSV = `Contenido;Título del vídeo;Duración;Vistas;Tiempo de visualización (horas);Impresiones de miniatura;Porcentaje de clics (%)
Total;;;;;;;
abc;Vídeo de prueba;10:33;1.234;2,5;10.000;8,64
`;

describe('parseStudioCsv', () => {
  it('parses the English Studio content export', () => {
    const report = parseStudioCsv(ENGLISH_CSV);

    expect(report.rows).toHaveLength(2);
    expect(report.total?.views).toBe(129_118);
    expect(report.medians.views).toBe(22_488.5);
    expect(report.medians.ctr).toBeCloseTo(8.455, 3);
    expect(report.medians.impressions).toBe(54_586.5);

    const row = report.rows[0];
    expect(row.videoId).toBe('IVgYzK-3tKA');
    expect(row.title).toBe('Zelda, PC');
    expect(row.durationSeconds).toBe(633);
    expect(row.views).toBe(28_398);
    expect(row.ctr).toBe(10.61);
    expect(row.avdSeconds).toBeCloseTo(51.34, 1);
    expect(row.averagePercentViewed).toBeCloseTo(8.11, 1);
  });

  it('parses Spanish headers, semicolons and local numbers', () => {
    const report = parseStudioCsv(SPANISH_CSV);

    expect(report.rows).toHaveLength(1);
    expect(report.delimiter).toBe(';');
    const row = report.rows[0];
    expect(row.videoId).toBe('abc');
    expect(row.title).toBe('Vídeo de prueba');
    expect(row.durationSeconds).toBe(633);
    expect(row.views).toBe(1234);
    expect(row.watchTimeHours).toBe(2.5);
    expect(row.impressions).toBe(10_000);
    expect(row.ctr).toBe(8.64);
    expect(row.avdSeconds).toBeCloseTo(7.29, 1);
    expect(row.averagePercentViewed).toBeCloseTo(1.15, 1);
  });

  it('ignores empty rows and handles a CSV without data', () => {
    const report = parseStudioCsv(
      'Content,Video title,Views\nTotal,,100\n,,,\n',
    );
    expect(report.rows).toHaveLength(0);
    expect(report.total?.views).toBe(100);
    expect(report.medians.views).toBeNull();
  });
});

describe('findCsvRow', () => {
  it('matches by video id first and title as fallback', () => {
    const report = parseStudioCsv(ENGLISH_CSV);

    expect(findCsvRow(report, 'IVgYzK-3tKA')?.title).toBe('Zelda, PC');
    expect(findCsvRow(report, 'missing', 'OpenCode')?.videoId).toBe('XegTYBBT4PY');
    expect(findCsvRow(report, 'missing', 'No existe')).toBeNull();
  });
});
