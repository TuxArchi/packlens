import { describe, expect, it } from 'vitest';
import {
  cleanTags,
  findDuplicates,
  fitTags,
  normalizeTags,
  parseTagsFromText,
  TAG_CHARACTER_LIMIT,
  tagCharacters,
} from '../src/core/tags';

describe('tags', () => {
  it('trims, deduplicates case-insensitively and preserves order', () => {
    expect(normalizeTags(['  viral ', 'Viral', 'tutorial', '', '  ', 'Tutorial'])).toEqual([
      'viral',
      'tutorial',
    ]);
  });

  it('finds duplicates ignoring case', () => {
    expect(findDuplicates(['a', 'A', 'b', 'b'])).toEqual(['a', 'b']);
  });

  it('counts characters like the YouTube tag field', () => {
    expect(tagCharacters(['uno', 'dos'])).toBe(7);
    expect(TAG_CHARACTER_LIMIT).toBe(500);
  });

  it('filters Studio UI labels and trims chip text', () => {
    expect(cleanTags(['  viral ', 'Add tag', 'Añadir etiqueta', '', 'viral'])).toEqual(['viral']);
    expect(cleanTags(['Mostrar más', 'etiquetas', 'tutorial'])).toEqual(['tutorial']);
  });

  it('parses values typed in a comma separated tag input', () => {
    expect(parseTagsFromText('uno, dos; tres\ncuatro')).toEqual([
      'uno',
      'dos',
      'tres',
      'cuatro',
    ]);
  });

  it('only adds missing tags and respects the budget', () => {
    expect(fitTags(['uno'], ['Uno', 'dos', 'tres'])).toEqual(['dos', 'tres']);
    expect(fitTags(['x'.repeat(400)], ['y'.repeat(100)])).toEqual([]);
  });
});
