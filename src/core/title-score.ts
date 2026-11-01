import { clamp, statusForScore } from './score';
import type { CheckResult } from './types';

// Common acronyms should not count as "shouting".
const ALLOWED_ACRONYMS = new Set([
  'SEO', 'API', 'URL', 'FAQ', 'IRL', 'AI', 'USA', 'HD', 'DIY', 'ASMR', 'RIP',
  'CEO', 'PC', 'GPS', 'CPU', 'GPU', 'USB', 'PDF', 'HTML', 'CSS', 'JS', 'SQL',
  'NFT', 'VPN', 'RAM', 'SSD', 'LTE', 'TV', 'DVD', 'LED', 'UFO', 'NASA', 'NBA',
  'NFL', 'UFC', 'WWE', 'IOS', 'MAC', 'AMD', 'NVIDIA', 'RTX', 'GTX', 'PS4', 'PS5',
  'XBOX',
]);

function makeCheck(
  id: string,
  weight: number,
  score: number,
  value: number,
  unit: CheckResult['unit'],
): CheckResult {
  const normalised = clamp(score, 0, 100);
  return {
    id,
    weight,
    score: normalised,
    status: statusForScore(normalised),
    value,
    unit,
  };
}

function scoreLength(length: number): number {
  if (length === 0) return 0;
  if (length < 20) return (length / 20) * 70;
  if (length < 30) return 70 + ((length - 20) / 10) * 30;
  if (length <= 60) return 100;
  return clamp(100 - (length - 60) * 2.2, 0, 100);
}

function scoreCaps(shoutingWords: number): number {
  if (shoutingWords === 0) return 100;
  if (shoutingWords === 1) return 60;
  return Math.max(10, 60 - shoutingWords * 15);
}

function scorePunctuation(bangs: number, emojis: number): number {
  return clamp(100 - bangs * 30 - Math.max(0, emojis - 1) * 20, 0, 100);
}

function scoreWords(words: number): number {
  if (words === 0) return 0;
  if (words < 4) return clamp(words * 22, 0, 80);
  if (words <= 12) return 100;
  return clamp(100 - (words - 12) * 12, 0, 100);
}

function isShouting(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4) return false;
  if (letters === letters.toLocaleLowerCase()) return false;
  if (letters !== letters.toLocaleUpperCase()) return false;
  return !ALLOWED_ACRONYMS.has(letters);
}

export function analyzeTitle(title: string): { score: number; checks: CheckResult[] } {
  const trimmed = title.trim();

  if (!trimmed) {
    return {
      score: 0,
      checks: [
        makeCheck('titleLength', 25, 0, 0, 'chars'),
        makeCheck('titleCaps', 20, 0, 0, 'count'),
        makeCheck('titlePunctuation', 20, 0, 0, 'count'),
        makeCheck('titleWords', 15, 0, 0, 'words'),
        makeCheck('titleSpecificity', 20, 0, 0, 'count'),
      ],
    };
  }

  const characters = Array.from(trimmed).length;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const shoutingWords = words.filter(isShouting).length;
  const bangs = (trimmed.match(/[!?]{2,}/g) ?? []).length;
  const emojis = (trimmed.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const hasNumber = /\d/.test(trimmed);
  const hasBrackets = /[[\](){}]/.test(trimmed);

  const checks: CheckResult[] = [
    makeCheck('titleLength', 25, scoreLength(characters), characters, 'chars'),
    makeCheck('titleCaps', 20, scoreCaps(shoutingWords), shoutingWords, 'count'),
    makeCheck('titlePunctuation', 20, scorePunctuation(bangs, emojis), bangs + emojis, 'count'),
    makeCheck('titleWords', 15, scoreWords(words.length), words.length, 'words'),
    makeCheck(
      'titleSpecificity',
      20,
      hasNumber ? 100 : hasBrackets ? 80 : 50,
      (hasNumber ? 1 : 0) + (hasBrackets ? 1 : 0),
      'count',
    ),
  ];

  const score =
    checks.reduce((sum, check) => sum + check.score * check.weight, 0) /
    checks.reduce((sum, check) => sum + check.weight, 0);

  return { score, checks };
}
