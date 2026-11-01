import { useEffect, useMemo, useState } from 'preact/hooks';
import { copyText } from '../../core/clipboard';
import {
  analyzeDescription,
  buildDescriptionProposal,
  diffLines,
} from '../../core/description';
import type {
  DescriptionAnalysis,
  DescriptionProposal,
} from '../../core/description';
import type { DescriptionCompetitionInsights } from '../../core/description-insights';
import { t } from '../../core/i18n';
import type {
  DescriptionInsightsResponse,
  StudioWriteResponse,
} from '../../core/messages';
import { detectKeyword } from '../../core/seo';
import type { KeywordVideo, VideoData } from '../../core/types';

interface Props {
  video: VideoData | null;
  keyword: string;
  topVideos: KeywordVideo[];
  isPro: boolean;
  onApplied: () => void;
}

function insightsError(response?: DescriptionInsightsResponse): string {
  switch (response?.code) {
    case 'no-key':
      return t('description.errorNoKey');
    case 'quota':
      return t('description.errorQuota');
    case 'no-videos':
      return t('description.errorNoKeyword');
    default:
      return t('description.errorApi');
  }
}

export function DescriptionOptimizer({
  video,
  keyword,
  topVideos,
  isPro,
  onApplied,
}: Props) {
  const [analysis, setAnalysis] = useState<DescriptionAnalysis | null>(null);
  const [proposal, setProposal] = useState<DescriptionProposal | null>(null);
  const [draft, setDraft] = useState('');
  const [competition, setCompetition] =
    useState<DescriptionCompetitionInsights | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [pendingApply, setPendingApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolvedKeyword = useMemo(() => {
    if (!video) return '';
    return keyword.trim() || detectKeyword(video.title, video.tags).keyword;
  }, [video, keyword]);

  const input = useMemo(
    () =>
      video
        ? {
            title: video.title,
            description: video.description,
            tags: video.tags,
            keyword: resolvedKeyword,
          }
        : null,
    [video, resolvedKeyword],
  );

  useEffect(() => {
    setProposal(null);
    setDraft('');
    setCompetition(null);
    setError(null);
    setMessage(null);
    setPendingApply(false);
    setShowDiff(false);

    if (!input) {
      setAnalysis(null);
      return;
    }

    setAnalysis(analyzeDescription(input));
  }, [input]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const after = useMemo(() => {
    if (!input || !draft.trim()) return null;
    return analyzeDescription({ ...input, description: draft });
  }, [input, draft]);

  const diff = useMemo(() => {
    if (!input || !proposal) return [];
    return diffLines(input.description, draft);
  }, [input, proposal, draft]);

  if (!video || !input || !analysis) return null;

  const isStudio = video.source === 'studio';
  const afterIssues = after?.issues ?? proposal?.after.issues ?? [];
  const afterScore = after?.score ?? proposal?.after.score ?? 0;
  const charCount = Array.from(draft).length;

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const generateBasic = () => {
    const next = buildDescriptionProposal(input, { mode: 'basic' });
    setProposal(next);
    setDraft(next.text);
    setError(null);
    setMessage(null);
    setPendingApply(false);
    setShowDiff(false);
  };

  const generateAdvanced = async () => {
    if (!isPro || busy) return;
    if (topVideos.length === 0) {
      setError(t('description.errorNoKeyword'));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      let insights = competition;
      if (!insights) {
        const response = (await browser.runtime.sendMessage({
          type: 'GET_DESCRIPTION_INSIGHTS',
          videoIds: topVideos.map((item) => item.videoId),
          keyword: resolvedKeyword,
        })) as DescriptionInsightsResponse | undefined;

        if (!response?.ok || !response.data) {
          setError(insightsError(response));
          return;
        }

        insights = response.data;
        setCompetition(insights);
      }

      const next = buildDescriptionProposal(input, {
        mode: 'advanced',
        competition: insights,
      });
      setProposal(next);
      setDraft(next.text);
      setPendingApply(false);
      setShowDiff(false);
    } catch {
      setError(t('description.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const copyDescription = async () => {
    const ok = await copyText(draft);
    if (ok) setCopied(true);
  };

  const applyDescription = async () => {
    if (!draft.trim() || applying) return;

    if (!isStudio) {
      setError(t('description.onlyStudio'));
      return;
    }

    setApplying(true);
    setError(null);
    setMessage(null);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'SET_STUDIO_DESCRIPTION',
        description: draft,
        videoId: video.videoId,
      })) as StudioWriteResponse | undefined;

      if (response?.ok) {
        setMessage(t('description.applied'));
        setPendingApply(false);
        onApplied();
        return;
      }

      if (response?.needsPaste) {
        const copiedOk = await copyText(draft);
        setMessage(
          copiedOk ? t('description.fallbackCopied') : t('description.fallback'),
        );
        setPendingApply(false);
        return;
      }

      setError(t('description.errorWrite'));
    } catch {
      setError(t('description.errorGeneric'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <section class="card desc-optimizer">
      <div class="desc-head">
        <div>
          <h3 class="section-title">{t('description.title')}</h3>
          <p class="muted">{t('description.intro')}</p>
        </div>
        <span class={`plan-badge ${isPro ? 'is-pro' : 'is-free'}`}>
          {isPro ? t('license.planPro') : t('license.planFree')}
        </span>
      </div>

      <div class="desc-summary">
        <span class="desc-score">
          {t('description.currentScore', [String(analysis.score)])}
        </span>
        <span class="desc-meta">
          {t('description.meta', [
            String(analysis.wordCount),
            String(analysis.charCount),
          ])}
        </span>
      </div>

      {analysis.issues.length > 0 ? (
        <ul class="desc-issues">
          {analysis.issues.slice(0, 4).map((issue) => (
            <li class={`desc-issue is-${issue.severity}`} key={issue.code}>
              {t(`description.issue.${issue.code}`)}
            </li>
          ))}
        </ul>
      ) : (
        <p class="desc-good">{t('description.noIssues')}</p>
      )}

      <div class="desc-actions">
        <button type="button" class="button" onClick={generateBasic}>
          {t('description.generateBasic')}
        </button>
        {isPro ? (
          <button
            type="button"
            class="button button-primary"
            disabled={busy}
            onClick={() => void generateAdvanced()}
          >
            {busy ? t('description.analyzing') : t('description.generateAdvanced')}
          </button>
        ) : (
          <button type="button" class="button" onClick={openOptions}>
            {t('description.unlockPro')}
          </button>
        )}
      </div>

      {!isPro && <p class="hint">{t('description.advancedLocked')}</p>}

      {competition && (
        <div class="desc-competition">
          <p>
            {t('description.competition', [
              String(competition.keywordCoverage),
              String(competition.sampleSize),
            ])}
          </p>
          {competition.commonTerms.length > 0 && (
            <p>
              {t('description.terms', [
                competition.commonTerms.slice(0, 5).join(', '),
              ])}
            </p>
          )}
          {competition.commonHashtags.length > 0 && (
            <p>
              {t('description.hashtags', [
                competition.commonHashtags.slice(0, 5).join(' '),
              ])}
            </p>
          )}
        </div>
      )}

      {error && <p class="notice">{error}</p>}
      {message && <p class="status">{message}</p>}

      {proposal && (
        <div class="desc-preview">
          <div class="desc-preview-head">
            <span class="desc-preview-title">{t('description.preview')}</span>
            <span class="desc-score-change">
              {t('description.scoreChange', [
                String(proposal.before.score),
                String(afterScore),
              ])}
            </span>
          </div>

          <textarea
            class="input desc-textarea"
            rows={12}
            maxLength={5000}
            value={draft}
            onInput={(event) => {
              setDraft((event.currentTarget as HTMLTextAreaElement).value);
              setPendingApply(false);
            }}
          />

          <p class="desc-meta">
            {t('description.charCount', [String(charCount)])}
          </p>

          <div class="desc-actions">
            <button
              type="button"
              class="button"
              disabled={!draft.trim()}
              onClick={() => void copyDescription()}
            >
              {copied ? t('ui.copied') : t('description.copy')}
            </button>
            {isStudio ? (
              <button
                type="button"
                class="button button-primary"
                disabled={!draft.trim() || applying}
                onClick={() => setPendingApply(true)}
              >
                {t('description.apply')}
              </button>
            ) : (
              <span class="kw-note">{t('description.onlyStudio')}</span>
            )}
            <button
              type="button"
              class="button"
              onClick={() => setShowDiff((value) => !value)}
            >
              {showDiff ? t('description.hideDiff') : t('description.showDiff')}
            </button>
          </div>

          {showDiff && (
            <ul class="desc-diff">
              {diff.length === 0 ? (
                <li class="desc-diff-line is-same">
                  {t('description.noChanges')}
                </li>
              ) : (
                diff.map((line, index) => (
                  <li
                    class={`desc-diff-line is-${line.type}`}
                    key={`${line.type}-${index}`}
                  >
                    {line.type === 'added' ? '+ ' : '− '}
                    {line.text}
                  </li>
                ))
              )}
            </ul>
          )}

          {afterIssues.length > 0 && (
            <p class="desc-meta">
              {t('description.remaining', [String(afterIssues.length)])}
            </p>
          )}

          {pendingApply && (
            <div class="desc-confirm">
              <p class="kw-confirm-text">{t('description.confirm')}</p>
              <div class="kw-confirm-actions">
                <button
                  type="button"
                  class="button button-primary"
                  disabled={applying}
                  onClick={() => void applyDescription()}
                >
                  {t('keywords.confirm')}
                </button>
                <button
                  type="button"
                  class="button"
                  disabled={applying}
                  onClick={() => setPendingApply(false)}
                >
                  {t('keywords.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
