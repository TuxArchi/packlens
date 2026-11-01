import { t } from '../../core/i18n';
import { statusForScore } from '../../core/score';

export function ScoreRing({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const normalised = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - normalised / 100);
  const status = statusForScore(normalised);

  return (
    <div class={`score-ring score-${status}`}>
      <svg viewBox="0 0 110 110" width="110" height="110" aria-hidden="true">
        <circle class="ring-track" cx="55" cy="55" r={radius} />
        <circle
          class="ring-value"
          cx="55"
          cy="55"
          r={radius}
          style={{
            strokeDasharray: `${circumference}`,
            strokeDashoffset: `${offset}`,
          }}
        />
      </svg>
      <div class="score-center">
        <span class="score-number">{Math.round(normalised)}</span>
        <span class="score-label">{t(`score.${verdict(score)}`)}</span>
      </div>
    </div>
  );
}

function verdict(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}
