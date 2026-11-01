import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../core/clipboard';
import { t } from '../core/i18n';
import { formatNumber } from '../core/format';
import type { LicenseSnapshot } from '../core/license';
import type { LicenseResponse, QuotaResponse } from '../core/messages';
import { CHECKOUT_URLS, PRICES } from '../core/pricing';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../core/settings';
import type { QuotaState } from '../core/types';

type Status = 'idle' | 'saved' | 'reset';
type LicenseAction = 'activate' | 'deactivate' | 'validate';

function licenseStatusLabel(snapshot: LicenseSnapshot | null): string {
  if (!snapshot?.keyMasked) return t('license.statusFree');
  if (snapshot.isPro) return t('license.statusActive');
  if (snapshot.status === 'inactive') return t('license.statusInactive');
  if (snapshot.status === 'expired') return t('license.statusExpired');
  if (snapshot.status === 'disabled') return t('license.statusDisabled');
  return t('license.statusInvalid');
}

function licenseErrorMessage(code?: string): string {
  switch (code) {
    case 'empty-key':
      return t('license.errorEmpty');
    case 'network':
    case 'timeout':
      return t('license.errorNetwork');
    case 'activation-failed':
    case 'deactivation-failed':
      return t('license.errorFailed');
    case 'storage-unavailable':
      return t('license.errorStorage');
    default:
      return t('license.errorGeneric');
  }
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function Options() {
  const [apiKey, setApiKey] = useState('');
  const [showButton, setShowButton] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [license, setLicense] = useState<LicenseSnapshot | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseBusy, setLicenseBusy] = useState<LicenseAction | null>(null);
  const [licenseMessage, setLicenseMessage] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

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

    void browser.runtime
      .sendMessage({ type: 'GET_LICENSE' })
      .then((response: LicenseResponse | undefined) => {
        if (response?.ok && response.data) setLicense(response.data);
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

  async function runLicenseAction(
    action: LicenseAction,
    key?: string,
  ): Promise<void> {
    setLicenseBusy(action);
    setLicenseMessage(null);
    setLicenseError(null);

    const type =
      action === 'activate'
        ? 'ACTIVATE_LICENSE'
        : action === 'deactivate'
          ? 'DEACTIVATE_LICENSE'
          : 'VALIDATE_LICENSE';

    try {
      const response = (await browser.runtime.sendMessage({
        type,
        ...(action === 'activate' ? { key: key ?? licenseKey } : {}),
      })) as LicenseResponse | undefined;

      if (response?.data) setLicense(response.data);

      if (!response?.ok) {
        setLicenseError(licenseErrorMessage(response?.error));
        return;
      }

      if (action === 'activate') {
        setLicenseKey('');
        setLicenseMessage(t('license.activated'));
      } else if (action === 'deactivate') {
        setLicenseMessage(t('license.deactivated'));
      } else {
        setLicenseMessage(
          response.offline
            ? response.data?.isPro
              ? t('license.offline')
              : t('license.offlineExpired')
            : t('license.validated'),
        );
      }
    } catch {
      setLicenseError(t('license.errorGeneric'));
    } finally {
      setLicenseBusy(null);
    }
  }

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

      <section class="card field license-card">
        <div class="license-head">
          <div>
            <h3 class="license-title">{t('license.title')}</h3>
            <p class="hint">{t('license.hint')}</p>
          </div>
          <span class={`plan-badge ${license?.isPro ? 'is-pro' : 'is-free'}`}>
            {license?.isPro ? t('license.planPro') : t('license.planFree')}
          </span>
        </div>

        {license?.keyMasked ? (
          <div class="license-meta">
            <div>
              <span>{t('license.status')}</span>
              <strong>{licenseStatusLabel(license)}</strong>
            </div>
            <div>
              <span>{t('license.key')}</span>
              <code>{license.keyMasked}</code>
            </div>
            {license.variantName && (
              <div>
                <span>{t('license.plan')}</span>
                <span>{license.variantName}</span>
              </div>
            )}
            {license.activationLimit != null && (
              <div>
                <span>{t('license.devices')}</span>
                <span>
                  {license.activationUsage ?? 0}/{license.activationLimit}
                </span>
              </div>
            )}
            {license.expiresAt && (
              <div>
                <span>{t('license.expires')}</span>
                <span>{formatDate(license.expiresAt)}</span>
              </div>
            )}
            {license.lastValidatedAt && (
              <div>
                <span>{t('license.lastCheck')}</span>
                <span>{formatDate(license.lastValidatedAt)}</span>
              </div>
            )}
            {license.isPro && license.offlineGraceUntil && (
              <div>
                <span>{t('license.offlineUntil')}</span>
                <span>{formatDate(license.offlineGraceUntil)}</span>
              </div>
            )}
          </div>
        ) : (
          <p class="hint">{t('license.freeHint')}</p>
        )}

        {license?.canActivate && (
          <button
            type="button"
            class="button button-primary"
            disabled={licenseBusy !== null}
            onClick={() => void runLicenseAction('activate')}
          >
            {licenseBusy === 'activate'
              ? t('license.working')
              : t('license.activateDevice')}
          </button>
        )}

        {(!license?.keyMasked ||
          license?.status === 'invalid' ||
          license?.status === 'expired' ||
          license?.status === 'disabled') && (
          <div class="license-activate">
            <input
              class="input"
              type="password"
              autocomplete="off"
              spellcheck={false}
              placeholder={t('license.keyPlaceholder')}
              value={licenseKey}
              onInput={(event) =>
                setLicenseKey((event.currentTarget as HTMLInputElement).value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  licenseKey.trim().length > 0 &&
                  licenseBusy === null
                ) {
                  void runLicenseAction('activate', licenseKey);
                }
              }}
            />
            <button
              type="button"
              class="button button-primary"
              disabled={licenseBusy !== null || licenseKey.trim().length === 0}
              onClick={() => void runLicenseAction('activate', licenseKey)}
            >
              {licenseBusy === 'activate'
                ? t('license.working')
                : t('license.activate')}
            </button>
          </div>
        )}

        {license?.canDeactivate && (
          <div class="license-actions">
            <button
              type="button"
              class="button"
              disabled={licenseBusy !== null}
              onClick={() => void runLicenseAction('validate')}
            >
              {licenseBusy === 'validate'
                ? t('license.working')
                : t('license.validate')}
            </button>
            <button
              type="button"
              class="button"
              disabled={licenseBusy !== null}
              onClick={() => void runLicenseAction('deactivate')}
            >
              {licenseBusy === 'deactivate'
                ? t('license.working')
                : t('license.deactivate')}
            </button>
          </div>
        )}

        {licenseMessage && <p class="status">{licenseMessage}</p>}
        {licenseError && <p class="notice">{licenseError}</p>}

        <p class="hint">{t('license.privacy')}</p>
        <div class="license-buy">
          <a
            href={CHECKOUT_URLS.monthly}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('license.buyMonthly', [PRICES.monthly])}
          </a>
          <a
            href={CHECKOUT_URLS.annual}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('license.buyAnnual', [PRICES.annual])}
          </a>
        </div>
      </section>

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
