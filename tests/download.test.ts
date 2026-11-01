import { describe, expect, it } from 'vitest';
import { safeFilename, toCsv } from '../src/core/download';

describe('toCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = toCsv([
      ['name', 'value'],
      ['a,b', 'line 1\nline 2'],
      ['say "hi"', null],
    ]);

    expect(csv).toBe(
      'name,value\r\n"a,b","line 1\nline 2"\r\n"say ""hi""",',
    );
  });
});

describe('safeFilename', () => {
  it('removes accents and unsafe characters', () => {
    expect(safeFilename('Cómo editar vídeos: 2026')).toBe(
      'como-editar-videos-2026',
    );
  });

  it('falls back when there is nothing usable', () => {
    expect(safeFilename('###', 'channel')).toBe('channel');
  });
});
