import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../../core/clipboard';
import { t } from '../../core/i18n';
import { findDuplicates, normalizeTags, TAG_CHARACTER_LIMIT, tagCharacters } from '../../core/tags';
import type { DataSource } from '../../core/types';

interface Props {
  tags: string[];
  source: DataSource;
  onRetry: () => void;
}

export function TagsPanel({ tags, source, onRetry }: Props) {
  const [copied, setCopied] = useState(false);
  const unique = normalizeTags(tags);
  const duplicates = findDuplicates(tags);
  const characters = tagCharacters(unique);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const ratio = Math.min(1, characters / TAG_CHARACTER_LIMIT);
  const barClass =
    characters > TAG_CHARACTER_LIMIT ? 'is-bad' : characters > TAG_CHARACTER_LIMIT * 0.85 ? 'is-warn' : '';

  return (
    <section class="card block">
      <div class="tags-head">
        <h3 class="section-title">{t('tags.heading')}</h3>
        {unique.length > 0 && (
          <button
            type="button"
            class="button"
            onClick={async () => {
              const ok = await copyText(unique.join(', '));
              if (ok) setCopied(true);
            }}
          >
            {copied ? t('ui.copied') : t('tags.copyAll')}
          </button>
        )}
      </div>

      <p class="tags-summary">
        {t('tags.count', [String(unique.length)])} ·{' '}
        {t('tags.chars', [String(characters), String(TAG_CHARACTER_LIMIT)])}
      </p>

      <div class="progress" aria-hidden="true">
        <div class={`progress-bar ${barClass}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      {duplicates.length > 0 && (
        <p class="notice">
          {t('tags.duplicates', [String(duplicates.length)])} — {t('tags.duplicateHint')}
        </p>
      )}

      {unique.length === 0 ? (
        <div class="tags-empty">
          <p class="muted">
            {source === 'studio' ? t('tags.studioHint') : t('tags.empty')}
          </p>
          {source === 'studio' && (
            <button type="button" class="button" onClick={onRetry}>
              {t('tags.expand')}
            </button>
          )}
        </div>
      ) : (
        <div class="tag-chips">
          {unique.map((tag) => (
            <span class="tag-chip" key={tag} title={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
