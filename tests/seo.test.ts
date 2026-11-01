import { describe, expect, it } from 'vitest';
import { analyzeSeo, detectKeyword } from '../src/core/seo';

const FILLER =
  'Este tutorial cubre ajustes de color, audio, ritmo y exportación para que tu contenido se vea profesional y retenga a la audiencia.';

const GOOD_DESCRIPTION = [
  'En esta guía aprendes a editar videos en 2026 paso a paso.',
  'Veremos cómo editar videos con Premiere Pro, Final Cut y DaVinci Resolve, y cómo editar videos para YouTube sin perder calidad.',
  '00:00 Introducción',
  '01:30 Ajustes de color',
  '03:00 Audio',
  'https://example.com/recursos',
  ...Array.from({ length: 12 }, () => FILLER),
  'Suscríbete para más tutoriales.',
  '#editing #youtube #video #tutorial',
].join('\n');

const GOOD_TAGS = [
  'editar videos',
  'edición de video',
  'tutorial de edición',
  'editar videos en 2026',
  'premiere pro',
  'final cut pro',
  'davinci resolve',
  'edición para youtube',
  'consejos de edición',
  'ajustes de video',
  'color grading',
  'audio para video',
  'exportar video',
  'youtube seo',
  'crear contenido',
  'video editing',
  'editing tips',
];

const GOOD_TITLE = 'Cómo editar videos en 2026: 7 ajustes clave';

describe('detectKeyword', () => {
  it('uses the manual keyword first', () => {
    expect(detectKeyword(GOOD_TITLE, GOOD_TAGS, 'mi keyword')).toEqual({
      keyword: 'mi keyword',
      source: 'user',
    });
  });

  it('falls back to the first tag', () => {
    expect(detectKeyword(GOOD_TITLE, GOOD_TAGS)).toEqual({
      keyword: 'editar videos',
      source: 'tag',
    });
  });

  it('derives a keyword from the title without stopwords', () => {
    expect(detectKeyword(GOOD_TITLE, [])).toEqual({
      keyword: 'editar videos',
      source: 'title',
    });
  });

  it('returns an empty keyword when there is nothing to use', () => {
    expect(detectKeyword('', [])).toEqual({ keyword: '', source: 'none' });
  });
});

describe('analyzeSeo', () => {
  it('scores a complete description, tag set and title highly', () => {
    const report = analyzeSeo({
      title: GOOD_TITLE,
      description: GOOD_DESCRIPTION,
      tags: GOOD_TAGS,
    });

    expect(report.score).toBeGreaterThan(85);
    expect(report.keyword).toBe('editar videos');
    expect(report.description.checks.every((check) => check.status === 'good')).toBe(true);
    expect(report.tags.checks.every((check) => check.status === 'good')).toBe(true);
  });

  it('scores empty metadata low', () => {
    const report = analyzeSeo({ title: '', description: '', tags: [] });
    expect(report.score).toBeLessThan(30);
    expect(report.keyword).toBe('');
  });

  it('detects keyword stuffing', () => {
    const stuffed = Array.from({ length: 8 }, () => 'editar videos').join(' ');
    const report = analyzeSeo({
      title: 'editar videos',
      description: stuffed,
      tags: ['editar videos'],
      keyword: 'editar videos',
    });
    const check = report.description.checks.find((item) => item.id === 'seoDescriptionKeyword');
    expect(check?.status).not.toBe('good');
  });

  it('penalises a description that does not mention the keyword', () => {
    const report = analyzeSeo({
      title: 'Recetas fáciles',
      description: 'Una descripción sobre cocina y postres.',
      tags: ['recetas'],
      keyword: 'editar videos',
    });
    const check = report.description.checks.find((item) => item.id === 'seoDescriptionKeyword');
    expect(check?.value).toBe(0);
    expect(check?.score).toBe(0);
  });

  it('accepts a manual keyword override', () => {
    const report = analyzeSeo({
      title: GOOD_TITLE,
      description: GOOD_DESCRIPTION,
      tags: GOOD_TAGS,
      keyword: 'editar videos gratis',
    });
    expect(report.keyword).toBe('editar videos gratis');
    expect(report.keywordSource).toBe('user');
  });
});
