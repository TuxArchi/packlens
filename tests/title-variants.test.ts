import { describe, expect, it } from 'vitest';
import { generateTitleVariants } from '../src/core/title-variants';
import { fold } from '../src/core/seo';
import type { KeywordVideo } from '../src/core/types';

function video(title: string, views = 1000): KeywordVideo {
  return {
    videoId: title,
    title,
    channelId: 'UC123',
    channelTitle: 'Canal',
    views,
    subs: 1000,
    publishedAt: new Date().toISOString(),
    durationSeconds: 300,
  };
}

const spanishVideos = [
  video('Cómo editar videos en 2026 para principiantes', 10_000),
  video('Editar videos rápido: 5 trucos que funcionan', 8_000),
  video('Guía completa de editar videos desde cero', 5_000),
  video('Editar videos sin complicaciones', 3_000),
  video('7 errores al editar videos que debes evitar', 2_000),
];

const englishVideos = [
  video('How to edit videos step by step', 10_000),
  video('7 video editing tips for beginners', 8_000),
  video('Video editing from scratch', 5_000),
  video('Video editing without expensive software', 3_000),
];

describe('generateTitleVariants', () => {
  it('generates ten unique Spanish variants with the keyword', () => {
    const variants = generateTitleVariants('editar videos', spanishVideos, {
      now: new Date('2026-11-01T12:00:00Z'),
    });

    expect(variants).toHaveLength(10);
    expect(new Set(variants.map((variant) => fold(variant.title))).size).toBe(10);

    for (const variant of variants) {
      expect(fold(variant.title)).toContain('editar videos');
      expect(Array.from(variant.title).length).toBeLessThanOrEqual(100);
      expect(variant.score).toBeGreaterThanOrEqual(0);
      expect(variant.score).toBeLessThanOrEqual(100);
      expect(variant.reasons.length).toBeGreaterThan(0);
    }

    const titles = variants.map((variant) => variant.title);
    expect(titles.some((title) => title.startsWith('Editar videos'))).toBe(true);
    expect(titles.some((title) => title.includes('2026'))).toBe(true);
    expect(titles.some((title) => /\b(5|7)\b/.test(title))).toBe(true);
  });

  it('sorts variants by score', () => {
    const variants = generateTitleVariants('editar videos', spanishVideos);
    for (let index = 1; index < variants.length; index += 1) {
      expect(variants[index - 1].score).toBeGreaterThanOrEqual(variants[index].score);
    }
  });

  it('uses English templates for English keywords', () => {
    const variants = generateTitleVariants('video editing', englishVideos);

    expect(variants.length).toBeGreaterThan(0);
    expect(
      variants.some((variant) => variant.title.startsWith('A step-by-step')),
    ).toBe(true);
    expect(variants.some((variant) => variant.title.includes('for beginners'))).toBe(true);
    for (const variant of variants) {
      expect(fold(variant.title)).toContain('video editing');
    }
  });

  it('uses How to for English verb keywords', () => {
    const variants = generateTitleVariants('edit videos', englishVideos);
    expect(
      variants.some((variant) => variant.title.startsWith('How to edit videos')),
    ).toBe(true);
  });

  it('uses Cómo for Spanish verbs and Guía for noun keywords', () => {
    const verb = generateTitleVariants('editar videos', spanishVideos);
    expect(verb.some((variant) => variant.title.startsWith('Cómo editar videos'))).toBe(
      true,
    );

    const noun = generateTitleVariants('youtube seo', spanishVideos);
    expect(noun.some((variant) => variant.title.startsWith('Guía de youtube seo'))).toBe(
      true,
    );
  });

  it('respects the limit option', () => {
    const variants = generateTitleVariants('editar videos', spanishVideos, {
      limit: 5,
    });
    expect(variants).toHaveLength(5);
  });

  it('still returns useful defaults without competition data', () => {
    const variants = generateTitleVariants('editar videos', [], {
      now: new Date('2026-11-01T12:00:00Z'),
    });

    expect(variants).toHaveLength(10);
    expect(variants.every((variant) => fold(variant.title).includes('editar videos'))).toBe(
      true,
    );
  });

  it('returns nothing for an empty keyword', () => {
    expect(generateTitleVariants('   ', spanishVideos)).toEqual([]);
  });
});
