import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../core/i18n';
import { analyzeSeo } from '../../core/seo';
import type { VideoData } from '../../core/types';
import { CheckList } from './Checks';
import { ScoreRing } from './ScoreRing';

const STORAGE_PREFIX = 'seo-keyword:';

export function SeoPanel({ data }: { data: VideoData }) {
  const [manualKeyword, setManualKeyword] = useState<string | null>(null);
  const storageKey = data.videoId ? `${STORAGE_PREFIX}${data.videoId}` : null;

  useEffect(() => {
    let cancelled = false;
    setManualKeyword(null);

    if (!storageKey) {
      setManualKeyword('');
      return;
    }

    void browser.storage.local
      .get(storageKey)
      .then((stored) => {
        if (cancelled) return;
        const value = stored[storageKey];
        setManualKeyword(typeof value === 'string' ? value : '');
      })
      .catch(() => {
        if (!cancelled) setManualKeyword('');
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const keyword = manualKeyword ?? '';

  const report = useMemo(
    () =>
      analyzeSeo({
        title: data.title,
        description: data.description,
        tags: data.tags,
        keyword,
      }),
    [data.title, data.description, data.tags, keyword],
  );

  const save = () => {
    if (!storageKey) return;
    void browser.storage.local.set({ [storageKey]: manualKeyword ?? '' }).catch(() => undefined);
  };

  const sections = [
    { key: 'description' as const, label: t('seo.sectionDescription') },
    { key: 'tags' as const, label: t('seo.sectionTags') },
    { key: 'title' as const, label: t('seo.sectionTitle') },
  ];

  return (
    <>
      <section class="card score-card">
        <ScoreRing score={report.score} />
        <div class="score-copy">
          <p class="verdict">{t('seo.heading')}</p>
          <p class="muted">{t('seo.disclaimer')}</p>
        </div>
      </section>

      <section class="card seo-keyword">
        <label class="seo-keyword-label" for="seo-keyword-input">
          {t('seo.keywordLabel')}
        </label>
        <input
          id="seo-keyword-input"
          class="input"
          type="text"
          autocomplete="off"
          placeholder={report.keyword || t('seo.keywordPlaceholder')}
          value={manualKeyword ?? ''}
          onInput={(event) =>
            setManualKeyword((event.currentTarget as HTMLInputElement).value)
          }
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        {keyword.trim() === '' && report.keyword ? (
          <p class="seo-detected">
            {t('seo.detected', [report.keyword])}
            {report.keywordSource === 'tag' ? ` · ${t('seo.fromTag')}` : ''}
          </p>
        ) : (
          <p class="hint">{t('seo.keywordHint')}</p>
        )}
      </section>

      {report.keyword === '' && <p class="notice">{t('seo.emptyKeyword')}</p>}

      {sections.map((section) => (
        <section class="block" key={section.key}>
          <h3 class="section-title">
            {section.label}
            <span class="section-score">{Math.round(report[section.key].score)}/100</span>
          </h3>
          <CheckList checks={report[section.key].checks} />
        </section>
      ))}
    </>
  );
}
