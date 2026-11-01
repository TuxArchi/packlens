import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../core/clipboard';
import { t } from '../core/i18n';
import { formatNumber } from '../core/format';
import type { QuotaResponse } from '../core/messages';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../core/settings';
import type { QuotaState } from '../core/types';

type Status = 'idle' | 'saved' | 'reset';

export function Options() {
  const [apiKey, setApiKey] = useState('');
  const [showButton, setShowButton] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    void getSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setShowButton(settings.showFloatingButton);
    });

    void browser.runtime
      .sendMessage({ type: 'GET_QUOTA' })
      .then((response: QuotaResponse | undefined) => {
        if (response?.ok && response.data) setQuota(response.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const copyKey = async () => {
    const value = apiKey.trim();
    if (!value) return;
    const ok = await copyText(value);
    if (ok) setCopiedKey(true);
  };

  async function save(): Promise<void> {
    await saveSettings({ apiKey: apiKey.trim(), showFloatingButton: showButton });
    setStatus('saved');
  }

  async function reset(): Promise<void> {
    await saveSettings(DEFAULT_SETTINGS);
    setApiKey(DEFAULT_SETTINGS.apiKey);
    setShowButton(DEFAULT_SETTINGS.showFloatingButton);
    setStatus('reset');
  }

  return (
    <main class="options">
      <header>
        <h1>{t('options.heading')}</h1>
        <p class="lead">{t('options.intro')}</p>
      </header>

      <section class="card field">
        <label for="api-key">{t('options.apiKey')}</label>
        <div class="api-row">
          {showKey ? (
            <input
              id="api-key"
              class="input"
              type="text"
              autocomplete="off"
              spellcheck={false}
              value={apiKey}
              onInput={(event) => setApiKey((event.currentTarget as HTMLInputElement).value)}
            />
          ) : (
            <input
              id="api-key"
              class="input"
              type="password"
              autocomplete="off"
              spellcheck={false}
              value={apiKey}
              onInput={(event) => setApiKey((event.currentTarget as HTMLInputElement).value)}
            />
          )}
          <button
            type="button"
            class="button"
            onClick={() => setShowKey((value) => !value)}
          >
            {showKey ? t('options.hideKey') : t('options.showKey')}
          </button>
          <button
            type="button"
            class="button"
            disabled={apiKey.trim().length === 0}
            onClick={() => void copyKey()}
          >
            {copiedKey ? t('ui.copied') : t('options.copyKey')}
          </button>
        </div>
        <p class="hint">{t('options.apiKeyHint')}</p>
        <p class="hint">{t('options.freeKey')}</p>
        {quota && (
          <p class="hint">
            {t('keywords.quota', [
              formatNumber(quota.searchesUsed),
              formatNumber(quota.searchLimit),
              formatNumber(quota.unitsUsed),
              formatNumber(quota.unitLimit),
            ])}
          </p>
        )}

        <div class="api-help">
          <h3 class="api-help-title">{t('options.howToGet')}</h3>
          <ol class="api-steps">
            <li>
              <a
                href="https://console.cloud.google.com/projectcreate"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('options.stepProject')}
              </a>
            </li>
            <li>
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('options.stepEnable')}
              </a>
            </li>
            <li>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('options.stepCreate')}
              </a>
            </li>
            <li>{t('options.stepRestrict')}</li>
          </ol>
        </div>
      </section>

      <section class="card field">
        <div class="switch">
          <input
            id="show-button"
            type="checkbox"
            checked={showButton}
            onChange={(event) => setShowButton((event.currentTarget as HTMLInputElement).checked)}
          />
          <div>
            <label for="show-button">{t('options.showButton')}</label>
            <p class="hint">{t('options.showButtonHint')}</p>
          </div>
        </div>
      </section>

      <div class="actions">
        <button type="button" class="button button-primary" onClick={() => void save()}>
          {t('options.save')}
        </button>
        <button type="button" class="button" onClick={() => void reset()}>
          {t('options.reset')}
        </button>
        {status === 'saved' && <span class="status">{t('options.saved')}</span>}
        {status === 'reset' && <span class="status">{t('options.resetDone')}</span>}
      </div>

      <footer class="footnote">
        <span>
          {t('options.version')}: {browser.runtime.getManifest().version}
        </span>
        <span>{t('options.privacy')}: local.</span>
      </footer>
    </main>
  );
}
