import { describe, expect, it } from 'vitest';
import {
  analyzeDescription,
  buildDescriptionProposal,
  deriveHashtags,
  diffLines,
  extractPreservedBlocks,
} from '../src/core/description';
import type { DescriptionInput } from '../src/core/description';

const input: DescriptionInput = {
  title: 'Cómo editar videos rápido en 2026',
  description: [
    'Hola, en este video hablamos de editar videos.',
    '',
    'https://example.com/curso',
    '',
    '00:00 Intro',
    '01:20 Edición',
    '',
    '#editarvideos #youtube',
  ].join('\n'),
  tags: ['editar videos', 'youtube seo', 'premiere pro', 'tutorial'],
  keyword: 'editar videos',
};

describe('analyzeDescription', () => {
  it('detects keyword, links, timestamps, hashtags and missing tags', () => {
    const analysis = analyzeDescription(input);

    expect(analysis.keyword).toBe('editar videos');
    expect(analysis.hasKeywordFirstLines).toBe(true);
    expect(analysis.keywordOccurrences).toBeGreaterThanOrEqual(1);
    expect(analysis.links).toHaveLength(1);
    expect(analysis.timestamps).toHaveLength(2);
    expect(analysis.hashtags).toHaveLength(2);
    expect(analysis.missingTags.length).toBeGreaterThan(0);
    expect(analysis.wordCount).toBeGreaterThan(0);
    expect(analysis.charCount).toBeGreaterThan(0);
    expect(analysis.issues.map((issue) => issue.code)).toContain('hashtags');
    expect(analysis.issues.map((issue) => issue.code)).toContain('tags');
  });

  it('works without an explicit keyword', () => {
    const analysis = analyzeDescription({
      ...input,
      keyword: '',
    });
    expect(analysis.keyword.length).toBeGreaterThan(0);
    expect(analysis.score).toBeGreaterThanOrEqual(0);
  });
});

describe('deriveHashtags', () => {
  it('builds three CamelCase hashtags from keyword and tags', () => {
    expect(
      deriveHashtags('editar videos', ['youtube seo', 'premiere pro'], [], 3),
    ).toEqual(['#EditarVideos', '#YoutubeSeo', '#PremierePro']);
  });

  it('removes accents and spaces', () => {
    expect(deriveHashtags('inteligencia artificial', [], [], 1)).toEqual([
      '#InteligenciaArtificial',
    ]);
  });

  it('filters generic hashtags and fills with keyword variants', () => {
    const tags = deriveHashtags('editar videos', ['video', 'youtube'], [], 3);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toBe('#EditarVideos');
    expect(tags).not.toContain('#Video');
    expect(tags).not.toContain('#Youtube');
  });

  it('deduplicates hashtags and fills up to the limit', () => {
    const tags = deriveHashtags('editar videos', ['editar videos'], ['#EditarVideos'], 3);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toBe('#EditarVideos');
    expect(new Set(tags).size).toBe(3);
  });
});

describe('extractPreservedBlocks', () => {
  it('keeps links, timestamps and credits but drops hashtags and intro', () => {
    const description = [
      'Hola, esto es el intro.',
      'https://example.com/curso',
      '00:00 Intro',
      '01:20 Edición',
      'Créditos: música de Example',
      '#editarvideos #youtube',
    ].join('\n');

    const preserved = extractPreservedBlocks(description);
    expect(preserved).toContain('https://example.com/curso');
    expect(preserved).toContain('00:00 Intro');
    expect(preserved).toContain('Créditos: música de Example');
    expect(preserved).not.toContain('Hola, esto es el intro.');
    expect(preserved).not.toContain('#editarvideos');
  });
});

describe('buildDescriptionProposal', () => {
  it('creates a proposal with keyword first, CTA, preserved blocks and 3 hashtags', () => {
    const proposal = buildDescriptionProposal(input, { mode: 'basic' });
    const lines = proposal.text.split('\n');

    expect(proposal.text.toLowerCase()).toContain('editar videos');
    expect(proposal.text).toContain('https://example.com/curso');
    expect(proposal.text).toContain('00:00 Intro');
    expect(proposal.text).toContain('En este vídeo:');
    expect(proposal.text).toContain('suscríbete');
    const nonEmptyLines = proposal.text.split('\n').filter(Boolean);
    expect(proposal.after.hashtags).toHaveLength(3);
    expect(lines[lines.length - 1].trim().split(/\s+/)).toHaveLength(3);
    expect(nonEmptyLines[nonEmptyLines.length - 2]).toContain('Tags:');
    expect(nonEmptyLines[nonEmptyLines.length - 1]).toMatch(/^#/);
    expect(proposal.after.keywordOccurrences).toBeGreaterThanOrEqual(2);
    expect(proposal.after.hasCta).toBe(true);
    expect(proposal.changes).toContain('hashtags');
    expect(proposal.changes).toContain('cta');
    expect(proposal.changes).toContain('structure');
    expect(Array.from(proposal.text).length).toBeLessThanOrEqual(5000);
  });

  it('uses English templates for English content', () => {
    const proposal = buildDescriptionProposal(
      {
        title: 'How to edit videos fast',
        description: 'In this video we edit videos.',
        tags: ['video editing', 'premiere pro'],
        keyword: 'video editing',
      },
      { mode: 'basic' },
    );

    expect(proposal.text).toContain('In this video');
    expect(proposal.text).toContain('subscribe');
    expect(proposal.after.hashtags).toHaveLength(3);
  });

  it('adds competition terms and hashtags in advanced mode', () => {
    const proposal = buildDescriptionProposal(input, {
      mode: 'advanced',
      competition: {
        sampleSize: 5,
        averageLength: 900,
        medianLength: 850,
        keywordCoverage: 3,
        commonTerms: ['edicion de video', 'premiere pro', 'capcut'],
        commonHashtags: ['#editing', '#premierepro'],
      },
    });

    expect(proposal.text).toContain('Temas relacionados');
    expect(proposal.hashtags).toContain('#Editing');
    expect(proposal.changes).toContain('competition');
    expect(proposal.after.hashtags).toHaveLength(3);
  });

  it('keeps the hashtag line when the body is huge', () => {
    const huge = Array.from({ length: 400 }, (_, index) => `Línea ${index}`).join(
      '\n',
    );
    const proposal = buildDescriptionProposal(
      { ...input, description: huge },
      { mode: 'basic' },
    );

    expect(Array.from(proposal.text).length).toBeLessThanOrEqual(5000);
    expect(proposal.text.trim().split('\n').pop()).toMatch(/^#/);
  });
});

describe('diffLines', () => {
  it('marks removed and added lines', () => {
    const diff = diffLines('uno\ndos', 'dos\ntres');
    expect(diff).toContainEqual({ type: 'removed', text: 'uno' });
    expect(diff).toContainEqual({ type: 'added', text: 'tres' });
    expect(diff.some((line) => line.text === 'dos')).toBe(false);
  });
});
