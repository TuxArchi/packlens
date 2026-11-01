import { useEffect, useMemo, useState } from 'preact/hooks';
import { copyText } from '../../core/clipboard';
import { formatAge, formatCompact, formatNumber } from '../../core/format';
import { t } from '../../core/i18n';
import type {
  KeywordSearchResponse,
  QuotaResponse,
  StudioWriteResponse,
} from '../../core/messages';
import { getSettings, saveSettings } from '../../core/settings';
import { analyzeTitleInsights } from '../../core/insights';
import { fitTags, normalizeTags } from '../../core/tags';
import { generateTitleVariants } from '../../core/title-variants';
import type { TitleVariant } from '../../core/title-variants';
import { suggestTitles } from '../../core/title-suggestions';
import type {
  KeywordMode,
  KeywordSearchResult,
  QuotaState,
  VideoData,
} from '../../core/types';

const EXAMPLES = ['youtube seo', 'editar videos', 'inteligencia artificial'];

interface Props {
  video: VideoData | null;
  onUseKeyword: (keyword: string) => void;
  onApplied: () => void;
  isPro: boolean;
}

export function KeywordPanel({ video, onUseKeyword, onApplied, isPro }: Props) {
  const [mode, setMode] = useState<KeywordMode>('api');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [copied, setCopied] = useState(false);

  const [pendingTags, setPendingTags] = useState<string[] | null>(null);
  const [tagsBusy, setTagsBusy] = useState(false);
  const [tagsMessage, setTagsMessage] = useState<string | null>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [titleCopied, setTitleCopied] = useState(false);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleMessage, setTitleMessage] = useState<string | null>(null);
  const [advancedTitles, setAdvancedTitles] = useState<TitleVariant[]>([]);

  const videoId = video?.videoId ?? null;
  const isStudio = video?.source === 'studio';

  useEffect(() => {
    void getSettings()
      .then((settings) => {
        setMode(settings.keywordMode);
        setHasKey(settings.apiKey.trim().length > 0);
      })
      .catch(() => setHasKey(false));

    void browser.runtime
      .sendMessage({ type: 'GET_QUOTA' })
      .then((response: QuotaResponse | undefined) => {
        if (response?.ok && response.data) setQuota(response.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!titleCopied) return;
    const timer = window.setTimeout(() => setTitleCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [titleCopied]);

  useEffect(() => {
    setAdvancedTitles([]);
  }, [result?.keyword]);

  const changeMode = (next: KeywordMode) => {
    setMode(next);
    setError(null);
    setResult(null);
    void saveSettings({ keywordMode: next }).catch(() => undefined);
  };

  const run = async (value: string = keyword) => {
    const query = value.trim();
    if (!query || loading) return;

    setKeyword(query);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'SEARCH_KEYWORD',
        keyword: query,
        mode,
      })) as KeywordSearchResponse | undefined;

      if (response?.ok && response.data) {
        setResult(response.data);
        setQuota(response.data.quota);
      } else {
        setError(response?.code ?? 'api');
      }
    } catch {
      setError('api');
    } finally {
      setLoading(false);
    }
  };

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const total = result?.top.length ?? 0;
  const patterns = result?.recommendations.patterns;
  const phrases = result?.recommendations.phrases ?? [];
  const suggested = result?.recommendations.suggestedTags ?? [];

  const existingTags = useMemo(
    () => (video ? normalizeTags(video.tags) : []),
    [video],
  );
  const addableTags = useMemo(
    () => fitTags(existingTags, result?.recommendations.suggestedTags ?? []),
    [existingTags, result],
  );

  const titleSuggestions = useMemo(
    () =>
      result ? suggestTitles(result.keyword, result.recommendations, result.top) : [],
    [result],
  );

  const titleInsights = useMemo(
    () => (result ? analyzeTitleInsights(result.keyword, result.top) : null),
    [result],
  );

  useEffect(() => {
    if (!result) {
      setTitleDraft('');
      return;
    }

    setTitleDraft(titleSuggestions[0]?.title ?? '');
    setPendingTitle(null);
    setTitleMessage(null);
    setPendingTags(null);
    setTagsMessage(null);
  }, [result, titleSuggestions]);

  const titleLength = Array.from(titleDraft).length;

  const copyTags = async () => {
    if (!result) return;
    const ok = await copyText(result.recommendations.suggestedTags.join(', '));
    if (ok) setCopied(true);
  };

  const copyTitle = async () => {
    const title = titleDraft.trim();
    if (!title) return;
    const ok = await copyText(title);
    if (ok) setTitleCopied(true);
  };

  const generateAdvancedTitles = () => {
    if (!result) return;
    setAdvancedTitles(generateTitleVariants(result.keyword, result.top));
  };

  const confirmAddTags = async () => {
    if (!pendingTags || pendingTags.length === 0 || tagsBusy) return;

    setTagsBusy(true);
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'ADD_STUDIO_TAGS',
        tags: pendingTags,
        videoId,
      })) as StudioWriteResponse | undefined;

      if (response?.ok) {
        setTagsMessage(
          t('keywords.addTagsSuccess', [String(response.added ?? pendingTags.length)]),
        );
        setPendingTags(null);
        onApplied();
      } else {
        await copyText(pendingTags.join(', '));
        setTagsMessage(t('keywords.addTagsFallback'));
        setPendingTags(null);
      }
    } catch {
      await copyText(pendingTags.join(', '));
      setTagsMessage(t('keywords.addTagsFallback'));
      setPendingTags(null);
    } finally {
      setTagsBusy(false);
    }
  };

  const confirmTitle = async () => {
    const title = pendingTitle?.trim();
    if (!title || titleBusy) return;

    setTitleBusy(true);
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'SET_STUDIO_TITLE',
        title,
        videoId,
      })) as StudioWriteResponse | undefined;

      if (response?.ok) {
        setTitleMessage(t('keywords.titleApplied'));
        setPendingTitle(null);
        onApplied();
      } else {
        await copyText(title);
        setTitleMessage(t('keywords.titleFallback'));
        setPendingTitle(null);
      }
    } catch {
      await copyText(title);
      setTitleMessage(t('keywords.titleFallback'));
      setPendingTitle(null);
    } finally {
      setTitleBusy(false);
    }
  };

  return (
    <>
      <section class="card">
        <h3 class="section-title">{t('keywords.heading')}</h3>
        <p class="muted">{t('keywords.intro')}</p>

        <div class="kw-mode" role="group" aria-label={t('keywords.heading')}>
          <button
            type="button"
            class={`kw-mode-button ${mode === 'api' ? 'is-active' : ''}`}
            aria-pressed={mode === 'api'}
            onClick={() => changeMode('api')}
          >
            {t('keywords.modeApi')}
          </button>
          <button
            type="button"
            class={`kw-mode-button ${mode === 'session' ? 'is-active' : ''}`}
            aria-pressed={mode === 'session'}
            onClick={() => changeMode('session')}
          >
            {t('keywords.modeSession')}
          </button>
        </div>

        {mode === 'session' && <p class="notice">{t('keywords.sessionWarning')}</p>}

        <div class="kw-form">
          <input
            class="input"
            type="text"
            autocomplete="off"
            placeholder={t('keywords.placeholder')}
            value={keyword}
            onInput={(event) => setKeyword((event.currentTarget as HTMLInputElement).value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void run();
            }}
          />
          <button
            type="button"
            class="button button-primary"
            disabled={loading || keyword.trim().length === 0}
            onClick={() => void run()}
          >
            {loading ? t('keywords.searching') : t('keywords.search')}
          </button>
        </div>

        <div class="kw-examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              class="kw-example"
              onClick={() => void run(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {mode === 'api' && (hasKey === false || error === 'no-key') && (
        <section class="card kw-setup">
          <h3 class="section-title">{t('keywords.noKeyTitle')}</h3>
          <p class="muted">{t('keywords.noKeyBody')}</p>
          <button type="button" class="button" onClick={openOptions}>
            {t('keywords.openSettings')}
          </button>
        </section>
      )}

      {error === 'quota' && <p class="notice">{t('keywords.errorQuota')}</p>}
      {error === 'invalid-key' && <p class="notice">{t('keywords.errorKey')}</p>}
      {error === 'session' && <p class="notice">{t('keywords.errorSession')}</p>}
      {error === 'api' && <p class="notice">{t('keywords.error')}</p>}

      {result && (
        <>
          <section class="card">
            <div class="kw-result-head">
              <h3 class="section-title">{t('keywords.resultsFor', [result.keyword])}</h3>
              <div class="kw-badges">
                {result.cached && <span class="kw-cached">{t('keywords.cached')}</span>}
                {result.mode === 'session' && (
                  <span class="kw-cached">{t('keywords.sessionBadge')}</span>
                )}
              </div>
            </div>

            <div class="kw-metrics">
              <div class={`kw-metric kw-${result.label}`}>
                <span class="kw-metric-label">{t('keywords.difficulty')}</span>
                <strong>{result.difficulty}</strong>
                <span class="kw-metric-tag">{t(`keywords.${result.label}`)}</span>
              </div>
              <div class="kw-metric">
                <span class="kw-metric-label">{t('keywords.interest')}</span>
                <strong>{result.interest}</strong>
                <span class="kw-metric-tag">/100</span>
              </div>
            </div>

            {!result.subsAvailable && <p class="kw-note">{t('keywords.approx')}</p>}

            <dl class="kw-stats">
              <div>
                <dt>{t('keywords.medianViews')}</dt>
                <dd>{formatCompact(result.medianViews)}</dd>
              </div>
              {result.subsAvailable && (
                <div>
                  <dt>{t('keywords.medianSubs')}</dt>
                  <dd>{formatCompact(result.medianSubs)}</dd>
                </div>
              )}
              <div>
                <dt>{t('keywords.recent')}</dt>
                <dd>{Math.round(result.recentRatio * 100)}%</dd>
              </div>
              <div>
                <dt>{t('keywords.titleMatch')}</dt>
                <dd>{Math.round(result.titleMatchRatio * 100)}%</dd>
              </div>
            </dl>

            {videoId && (
              <button
                type="button"
                class="button"
                onClick={() => onUseKeyword(result.keyword)}
              >
                {t('keywords.useInSeo')}
              </button>
            )}
          </section>

          <section class="card kw-recos">
            <h3 class="section-title">{t('keywords.recommendations')}</h3>

            {phrases.length > 0 && (
              <div class="kw-phrases">
                {phrases.map((phrase) => (
                  <span class="kw-phrase" key={phrase.text}>
                    {phrase.text} <b>{phrase.count}</b>
                  </span>
                ))}
              </div>
            )}

            {patterns && (
              <ul class="kw-patterns">
                <li>{t('keywords.patternNumber', [String(patterns.withNumber), String(total)])}</li>
                <li>{t('keywords.patternStart', [String(patterns.keywordAtStart), String(total)])}</li>
                <li>{t('keywords.patternYear', [String(patterns.withYear), String(total)])}</li>
                <li>{t('keywords.averageLength', [String(patterns.averageLength)])}</li>
              </ul>
            )}

            {suggested.length > 0 && (
              <>
                <div class="kw-suggested-head">
                  <span class="kw-sublabel">{t('keywords.suggestedTags')}</span>
                  <div class="kw-suggested-actions">
                    <button type="button" class="button" onClick={() => void copyTags()}>
                      {copied ? t('ui.copied') : t('keywords.copyTags')}
                    </button>
                    {isStudio && addableTags.length > 0 && (
                      <button
                        type="button"
                        class="button"
                        onClick={() => {
                          setTagsMessage(null);
                          setPendingTags(addableTags);
                        }}
                      >
                        {t('keywords.addToStudio', [String(addableTags.length)])}
                      </button>
                    )}
                  </div>
                </div>

                <div class="kw-suggested">
                  {suggested.map((tag) => (
                    <span class="tag-chip" key={tag} title={tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                {isStudio && addableTags.length === 0 && (
                  <p class="kw-note">{t('keywords.addTagsNone')}</p>
                )}
                {!isStudio && <p class="kw-note">{t('keywords.addOnlyStudio')}</p>}

                {pendingTags && (
                  <div class="kw-confirm">
                    <p class="kw-confirm-text">
                      {t('keywords.addTagsConfirm', [String(pendingTags.length)])}
                    </p>
                    <div class="kw-confirm-actions">
                      <button
                        type="button"
                        class="button button-primary"
                        disabled={tagsBusy}
                        onClick={() => void confirmAddTags()}
                      >
                        {t('keywords.confirm')}
                      </button>
                      <button
                        type="button"
                        class="button"
                        disabled={tagsBusy}
                        onClick={() => setPendingTags(null)}
                      >
                        {t('keywords.cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {tagsMessage && <p class="notice">{tagsMessage}</p>}
              </>
            )}
          </section>

          {titleSuggestions.length > 0 && (
            <section class="card kw-titles">
              <h3 class="section-title">{t('keywords.titleIdeas')}</h3>
              <p class="muted">{t('keywords.titleDisclaimer')}</p>

              <div class="kw-title-options">
                {titleSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.kind}
                    class={`kw-title-option ${
                      titleDraft === suggestion.title ? 'is-active' : ''
                    }`}
                    onClick={() => {
                      setTitleDraft(suggestion.title);
                      setPendingTitle(null);
                    }}
                  >
                    <span class="kw-sublabel">
                      {t(`keywords.titleKind.${suggestion.kind}`)}
                    </span>
                    <span>{suggestion.title}</span>
                  </button>
                ))}
              </div>

              <div class="kw-advanced">
                <div class="kw-advanced-head">
                  <span class="kw-sublabel">{t('keywords.advancedTitles')}</span>
                  <span class={`plan-badge ${isPro ? 'is-pro' : 'is-free'}`}>
                    {isPro ? t('license.planPro') : t('license.planFree')}
                  </span>
                </div>

                {isPro ? (
                  <>
                    {titleInsights && titleInsights.sampleSize > 0 && (
                      <div class="kw-insights">
                        <span>
                          {t('keywords.insightStart', [
                            String(titleInsights.keywordAtStart),
                            String(titleInsights.sampleSize),
                          ])}
                        </span>
                        <span>
                          {t('keywords.insightNumber', [
                            String(titleInsights.withNumber),
                            String(titleInsights.sampleSize),
                          ])}
                        </span>
                        <span>
                          {t('keywords.insightLength', [
                            String(titleInsights.medianLength),
                          ])}
                        </span>
                      </div>
                    )}
                    <p class="muted">{t('keywords.advancedTitlesHint')}</p>
                    <button
                      type="button"
                      class="button"
                      onClick={generateAdvancedTitles}
                    >
                      {t('keywords.generateTitles')}
                    </button>

                    {advancedTitles.length > 0 && (
                      <div class="kw-title-options">
                        {advancedTitles.map((variant) => (
                          <button
                            type="button"
                            key={variant.title}
                            class={`kw-title-option ${
                              titleDraft === variant.title ? 'is-active' : ''
                            }`}
                            onClick={() => {
                              setTitleDraft(variant.title);
                              setPendingTitle(null);
                            }}
                          >
                            <span class="kw-sublabel">
                              {variant.score}/100
                              {variant.reasons.length > 0
                                ? ` · ${variant.reasons
                                    .slice(0, 2)
                                    .map((reason) =>
                                      t(`keywords.titleReason.${reason}`),
                                    )
                                    .join(' · ')}`
                                : ''}
                            </span>
                            <span>{variant.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p class="muted">{t('keywords.advancedTitlesLocked')}</p>
                    <button type="button" class="button" onClick={openOptions}>
                      {t('keywords.unlockPro')}
                    </button>
                  </>
                )}
              </div>

              <input
                class="input"
                type="text"
                maxLength={100}
                value={titleDraft}
                onInput={(event) => {
                  setTitleDraft((event.currentTarget as HTMLInputElement).value);
                  setPendingTitle(null);
                }}
              />

              <p class={`kw-title-meta ${titleLength > 60 ? 'is-warn' : ''}`}>
                {t('keywords.titleChars', [String(titleLength)])} ·{' '}
                {t('keywords.titleLengthWarning')}
              </p>

              <div class="kw-title-actions">
                <button
                  type="button"
                  class="button"
                  disabled={!titleDraft.trim()}
                  onClick={() => void copyTitle()}
                >
                  {titleCopied ? t('ui.copied') : t('keywords.copyTitle')}
                </button>
                {isStudio ? (
                  <button
                    type="button"
                    class="button button-primary"
                    disabled={!titleDraft.trim() || titleBusy}
                    onClick={() => setPendingTitle(titleDraft.trim())}
                  >
                    {t('keywords.applyTitle')}
                  </button>
                ) : (
                  <span class="kw-note">{t('keywords.addOnlyStudio')}</span>
                )}
              </div>

              {pendingTitle && (
                <div class="kw-confirm">
                  <p class="kw-confirm-text">{t('keywords.titleConfirm')}</p>
                  <p class="kw-title-compare">
                    <span>{t('keywords.titleCurrent')}</span>
                    {video?.title || '—'}
                  </p>
                  <p class="kw-title-compare">
                    <span>{t('keywords.titleNew')}</span>
                    {pendingTitle}
                  </p>
                  <div class="kw-confirm-actions">
                    <button
                      type="button"
                      class="button button-primary"
                      disabled={titleBusy}
                      onClick={() => void confirmTitle()}
                    >
                      {t('keywords.confirm')}
                    </button>
                    <button
                      type="button"
                      class="button"
                      disabled={titleBusy}
                      onClick={() => setPendingTitle(null)}
                    >
                      {t('keywords.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {titleMessage && <p class="notice">{titleMessage}</p>}
            </section>
          )}

          <section class="block">
            <h3 class="section-title">{t('keywords.top')}</h3>
            {result.top.length === 0 ? (
              <p class="muted">{t('keywords.noResults')}</p>
            ) : (
              <ol class="kw-list">
                {result.top.map((item, index) => {
                  const age = formatAge(item.publishedAt) ?? item.publishedText ?? '';
                  return (
                    <li key={item.videoId}>
                      <a
                        class="kw-item"
                        href={`https://www.youtube.com/watch?v=${item.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span class="kw-rank">{index + 1}</span>
                        <span class="kw-item-main">
                          <span class="kw-item-title">{item.title}</span>
                          <span class="kw-item-meta">
                            {item.channelTitle} · {formatCompact(item.views)}{' '}
                            {t('keywords.views')}
                            {result.subsAvailable
                              ? ` · ${formatCompact(item.subs)} ${t('keywords.subs')}`
                              : ''}
                            {age ? ` · ${age}` : ''}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {result.mode === 'api' && quota && (
            <p class="kw-quota">
              {t('keywords.quota', [
                formatNumber(quota.searchesUsed),
                formatNumber(quota.searchLimit),
                formatNumber(quota.unitsUsed),
                formatNumber(quota.unitLimit),
              ])}
            </p>
          )}
        </>
      )}

      {!result && !error && <p class="muted">{t('keywords.empty')}</p>}
    </>
  );
}
