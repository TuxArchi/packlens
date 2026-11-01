import { describe, expect, it } from 'vitest';
import { analyzeTitle } from '../src/core/title-score';
import type { CheckResult } from '../src/core/types';

function check(title: string, id: string): CheckResult {
  const found = analyzeTitle(title).checks.find((item) => item.id === id);
  if (!found) throw new Error(`Missing check ${id}`);
  return found;
}

describe('analyzeTitle', () => {
  it('scores a specific, well sized title highly', () => {
    const report = analyzeTitle('Cómo editar videos en 2026: 7 ajustes clave');
    expect(report.score).toBeGreaterThan(90);
    expect(report.checks.find((item) => item.id === 'titleLength')?.status).toBe('good');
  });

  it('penalises shouting', () => {
    expect(check('ESTO ES INCREÍBLE DE VERDAD', 'titleCaps').status).toBe('bad');
  });

  it('allows known acronyms', () => {
    expect(check('SEO para YouTube en 2026', 'titleCaps').status).toBe('good');
  });

  it('penalises an empty title', () => {
    expect(analyzeTitle('').score).toBeLessThan(20);
  });

  it('penalises repeated punctuation and emoji spam', () => {
    expect(check('¡Increíble!!! 😱😱😱', 'titlePunctuation').status).toBe('bad');
  });

  it('rewards titles with a concrete number', () => {
    expect(check('7 ajustes de edición', 'titleSpecificity').score).toBe(100);
  });

  it('flags titles that are too short', () => {
    expect(check('Hola', 'titleWords').status).not.toBe('good');
  });
});
