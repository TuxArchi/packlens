import { computeThumbMetrics } from '../core/image-metrics';
import type { ThumbMetrics } from '../core/image-metrics';
import type { OpenPanelResponse, StudioWriteResponse } from '../core/messages';
import { t } from '../core/i18n';
import { cleanTags, fitTags, parseTagsFromText } from '../core/tags';
import type { VideoData } from '../core/types';

const EDIT_PAGE = /\/video\/([\w-]{11})\/edit/;

function currentVideoId(): string | null {
  const match = location.pathname.match(EDIT_PAGE);
  return match ? match[1] : null;
}

function isEditPage(): boolean {
  return EDIT_PAGE.test(location.pathname);
}

/**
 * Queries the light DOM and, when nothing matches, the open shadow roots of
 * custom elements. YouTube Studio mixes Polymer (light DOM) and newer views
 * with Shadow DOM, so querying only `document` is not enough.
 */
function queryDeep(selector: string, root: ParentNode = document, depth = 0): Element[] {
  const direct = Array.from(root.querySelectorAll(selector));
  if (direct.length > 0 || depth >= 3) return direct;

  const found: Element[] = [];
  for (const host of Array.from(root.querySelectorAll('*'))) {
    if (!host.tagName.includes('-')) continue;
    const shadow = (host as HTMLElement).shadowRoot;
    if (shadow) found.push(...queryDeep(selector, shadow, depth + 1));
  }
  return found;
}

function textOf(selector: string): string {
  const element = queryDeep(selector)[0];
  return (element?.textContent ?? '').replace(/\u200b/g, '').trim();
}

function readChips(scope: ParentNode): string[] {
  const labels = queryDeep('#chip-text, .chip-text', scope);
  const chips = labels.length > 0 ? labels : queryDeep('ytcp-chip', scope);
  return cleanTags(chips.map((chip) => chip.textContent ?? ''));
}

function readInputs(scope: ParentNode): string[] {
  const values = queryDeep('input, textarea', scope)
    .map((input) => (input as HTMLInputElement).value ?? '')
    .filter((value) => value.trim().length > 0);

  return cleanTags(values.flatMap((value) => parseTagsFromText(value)));
}

function looksLikeTagsInput(input: Element): boolean {
  const haystack = [
    input.id,
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('placeholder') ?? '',
    input.getAttribute('name') ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase();

  return /tag|etiqueta/.test(haystack);
}

function collectTags(): string[] {
  // Preferred source: the dedicated tags container.
  const container = queryDeep('#tags-container')[0];
  if (container) {
    const fromChips = readChips(container);
    if (fromChips.length > 0) return fromChips;

    const fromInputs = readInputs(container);
    if (fromInputs.length > 0) return fromInputs;
  }

  // Second source: chip bars inside the editor. Some Studio versions render
  // the tags editor without the #tags-container wrapper.
  const editor = queryDeep('ytcp-video-metadata-editor, ytcp-video-metadata-editor-basics')[0];
  const bars = editor ? queryDeep('ytcp-chip-bar', editor) : queryDeep('ytcp-chip-bar');

  for (const bar of bars) {
    const tags = readChips(bar);
    if (tags.length > 0) return tags;
  }

  // Last resort: tag-like inputs inside the editor.
  const inputRoot = editor ?? document;
  const tagInputs = queryDeep('input, textarea', inputRoot).filter(looksLikeTagsInput);
  if (tagInputs.length > 0) {
    return cleanTags(
      tagInputs.flatMap((input) =>
        parseTagsFromText((input as HTMLInputElement).value ?? ''),
      ),
    );
  }

  return [];
}

function detectVisibility(): VideoData['visibility'] {
  const scopes = [
    ...queryDeep('ytcp-video-metadata-visibility'),
    ...queryDeep('[id*="visibility"]'),
  ];
  let text = scopes
    .map((scope) => scope.textContent ?? '')
    .join(' ')
    .toLocaleLowerCase();

  if (!text) {
    text = document.body.innerText.slice(0, 20000).toLocaleLowerCase();
  }

  if (/programado|scheduled/.test(text)) return 'scheduled';
  if (/privado|private/.test(text)) return 'private';
  if (/oculto|unlisted/.test(text)) return 'unlisted';
  if (/público|public/.test(text)) return 'public';
  return 'unknown';
}

const thumbnailMetricsCache = new Map<string, ThumbMetrics>();

/**
 * The editor thumbnail lives on i9.ytimg.com with a signed, short-lived URL.
 * Loading it again with CORS from the page context keeps the canvas clean and
 * works for scheduled videos, where i.ytimg.com does not have the image yet.
 */
async function analyzeEditorThumbnail(
  image: HTMLImageElement | undefined,
): Promise<ThumbMetrics | null> {
  const src = image?.src;
  if (!src) return null;

  const cached = thumbnailMetricsCache.get(src);
  if (cached) return cached;

  const probe = new Image();
  if (/^https?:/i.test(src)) probe.crossOrigin = 'anonymous';

  const loaded = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 4000);
    probe.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    probe.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    probe.src = src;
  });

  if (!loaded || probe.naturalWidth === 0) return null;

  try {
    const width = 480;
    const height = Math.max(
      1,
      Math.round((probe.naturalHeight / probe.naturalWidth) * width),
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(probe, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height);
    const metrics = computeThumbMetrics({ data: data.data, width, height });

    thumbnailMetricsCache.set(src, metrics);
    if (thumbnailMetricsCache.size > 20) {
      const oldest = thumbnailMetricsCache.keys().next().value;
      if (oldest) thumbnailMetricsCache.delete(oldest);
    }

    return metrics;
  } catch {
    return null;
  }
}

async function collect(): Promise<VideoData | null> {
  const videoId = currentVideoId();
  const title =
    textOf('#title-textarea #textbox') ||
    textOf('ytcp-social-suggestions-textbox#title-textarea #textbox');

  const description =
    textOf('#description-textarea #textbox') ||
    textOf('ytcp-social-suggestions-textbox#description-textarea #textbox');

  if (!title && !videoId) return null;

  const editorThumbnail = queryDeep('ytcp-thumbnail-editor img, #thumbnail img')[0] as
    | HTMLImageElement
    | undefined;

  const thumbnailUrl = editorThumbnail?.src
    ? editorThumbnail.src
    : videoId
      ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      : null;

  const thumbnailFallbackUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : null;

  const thumbnailMetrics = await analyzeEditorThumbnail(editorThumbnail);

  return {
    source: 'studio',
    videoId,
    title,
    thumbnailUrl,
    thumbnailFallbackUrl,
    thumbnailMetrics,
    visibility: detectVisibility(),
    channel: null,
    views: null,
    publishedAt: null,
    lengthSeconds: null,
    tags: collectTags(),
    description,
    category: null,
  };
}

/**
 * A stable signature of the fields we care about. Mutations that do not change
 * title or tags (autosave spinners, counters, previews...) are ignored.
 */
function signature(): string {
  if (!isEditPage()) return '';
  const title =
    textOf('#title-textarea #textbox') ||
    textOf('ytcp-social-suggestions-textbox#title-textarea #textbox');
  const description =
    textOf('#description-textarea #textbox') ||
    textOf('ytcp-social-suggestions-textbox#description-textarea #textbox');

  const thumbnail = queryDeep('ytcp-thumbnail-editor img, #thumbnail img')[0] as
    | HTMLImageElement
    | undefined;

  return `${currentVideoId() ?? ''}\u0000${title}\u0000${collectTags().join('\u0001')}\u0000${hash(description)}\u0000${thumbnail?.src ?? ''}`;
}

async function expandEditor(): Promise<boolean> {
  if (queryDeep('#tags-container').length > 0) return true;

  const editor =
    queryDeep('ytcp-video-metadata-editor, ytcp-video-metadata-editor-basics')[0] ??
    document.body;

  const scopes: ParentNode[] = editor === document.body ? [document] : [editor, document];

  for (const scope of scopes) {
    const controls = queryDeep(
      'button, ytcp-button, tp-yt-paper-button, [role="button"]',
      scope,
    );
    const control = controls.find((element) => {
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!/^(mostrar más|show more|más opciones|more options)$/i.test(text)) return false;

      // Never click the description's own "Show more".
      return !element.closest(
        '#description, #description-textarea, ytcp-social-suggestions-textbox',
      );
    });

    if (!control) continue;

    (control as HTMLElement).click();
    await new Promise((resolve) => window.setTimeout(resolve, 700));

    if (queryDeep('#tags-container').length === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    return true;
  }

  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function dispatchInput(input: HTMLElement, data: string): void {
  try {
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data }),
    );
  } catch {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function enterKey(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
  });
}

async function insertTag(bar: any, tag: string): Promise<boolean> {
  let input: HTMLInputElement | null = null;

  try {
    input =
      typeof bar.getInput === 'function'
        ? bar.getInput()
        : bar.querySelector('#text-input');
  } catch {
    return false;
  }

  if (!input) return false;

  const chipCount = () => queryDeep('ytcp-chip', bar).length;
  const before = chipCount();
  input.focus();

  // 1) Native input value + input event + Enter.
  try {
    setNativeValue(input, tag);
    dispatchInput(input, tag);
    input.dispatchEvent(enterKey());
    input.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
      }),
    );
  } catch {
    // Try the chip bar API below.
  }

  await wait(160);
  if (chipCount() > before) return true;

  // 2) The chip bar's own helpers, which the diagnostic confirmed exist.
  try {
    bar.setInputText?.(tag);
    bar.handleInputKeyDown?.(enterKey());
  } catch {
    // Try the comma path below.
  }

  await wait(180);
  if (chipCount() > before) return true;

  // 3) Comma separator, the other key Studio accepts.
  try {
    setNativeValue(input, tag);
    dispatchInput(input, tag);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: ',',
        code: 'Comma',
        keyCode: 188,
        which: 188,
      }),
    );
  } catch {
    // Give up on this tag.
  }

  await wait(180);
  return chipCount() > before;
}

async function addStudioTags(
  tags: string[],
  videoId?: string | null,
): Promise<StudioWriteResponse> {
  if (videoId && currentVideoId() !== videoId) {
    return { ok: false, error: 'mismatch' };
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    return { ok: false, error: 'empty' };
  }

  let bar = queryDeep('#tags-container ytcp-chip-bar, ytcp-chip-bar')[0] as any;
  if (!bar) {
    await expandEditor();
    bar = queryDeep('#tags-container ytcp-chip-bar, ytcp-chip-bar')[0] as any;
  }
  if (!bar) return { ok: false, needsPaste: true, error: 'no-input' };

  const existing = collectTags();
  const toAdd = fitTags(existing, tags);
  let added = 0;

  for (const tag of toAdd) {
    if (await insertTag(bar, tag)) added += 1;
    else break;
  }

  scheduleChange(true);

  if (added === 0 && toAdd.length > 0) {
    return {
      ok: false,
      needsPaste: true,
      error: 'write',
      added: 0,
      skipped: tags.length,
    };
  }

  return { ok: true, added, skipped: Math.max(0, tags.length - added) };
}

async function setStudioTitle(
  rawTitle: string,
  videoId?: string | null,
): Promise<StudioWriteResponse> {
  if (videoId && currentVideoId() !== videoId) {
    return { ok: false, error: 'mismatch' };
  }

  const title = typeof rawTitle === 'string' ? rawTitle.trim().slice(0, 100) : '';
  if (!title) return { ok: false, error: 'empty' };

  const field = queryDeep('#title-textarea #textbox')[0] as HTMLElement | undefined;
  if (!field) return { ok: false, needsPaste: true, error: 'no-input' };

  field.focus();
  let applied = false;

  try {
    document.execCommand('selectAll', false);
    applied = document.execCommand('insertText', false, title);
  } catch {
    applied = false;
  }

  const current = (field.textContent ?? '').trim();
  if (!applied || current !== title) {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(field),
        'value',
      )?.set;
      if (setter) setter.call(field, title);
      else field.value = title;
    } else {
      field.textContent = title;
    }
    dispatchInput(field, title);
  }

  scheduleChange(true);

  const value =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.value
      : field.textContent ?? '';
  const ok = value.trim() === title;

  return ok ? { ok: true } : { ok: false, needsPaste: true, error: 'write' };
}

async function setStudioDescription(
  rawDescription: string,
  videoId?: string | null,
): Promise<StudioWriteResponse> {
  if (videoId && currentVideoId() !== videoId) {
    return { ok: false, error: 'mismatch' };
  }

  const description =
    typeof rawDescription === 'string' ? rawDescription.trim().slice(0, 5000) : '';
  if (!description) return { ok: false, error: 'empty' };

  const field = queryDeep('#description-textarea #textbox')[0] as
    | HTMLElement
    | undefined;
  if (!field) return { ok: false, needsPaste: true, error: 'no-input' };

  field.focus();
  let applied = false;

  try {
    document.execCommand('selectAll', false);
    applied = document.execCommand('insertText', false, description);
  } catch {
    applied = false;
  }

  const read = () =>
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.value
      : field.innerText || field.textContent || '';
  const matches = () => compactText(read()) === compactText(description);

  if (!applied || !matches()) {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(field),
        'value',
      )?.set;
      if (setter) setter.call(field, description);
      else field.value = description;
      dispatchInput(field, description);
    } else {
      const fragment = document.createDocumentFragment();
      for (const line of description.split('\n')) {
        const block = document.createElement('div');
        if (line) block.textContent = line;
        else block.appendChild(document.createElement('br'));
        fragment.appendChild(block);
      }
      field.replaceChildren(fragment);
      dispatchInput(field, description);
    }
  }

  scheduleChange(true);

  return matches() ? { ok: true } : { ok: false, needsPaste: true, error: 'write' };
}

function compactText(value: string): string {
  return value.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (Math.imul(value, 31) + text.charCodeAt(index)) | 0;
  }
  return value;
}

let debounce: number | undefined;
let burstStart = 0;
let lastSignature = '';

function scheduleChange(force = false): void {
  if (!isEditPage()) return;

  const now = Date.now();
  if (burstStart === 0) burstStart = now;

  if (debounce) window.clearTimeout(debounce);

  // Under a constant stream of mutations, still check every ~2.5s.
  const delay = now - burstStart > 2500 ? 0 : 650;

  debounce = window.setTimeout(() => {
    burstStart = 0;
    if (!isEditPage() || document.hidden) return;

    const next = signature();
    if (!force && next === lastSignature) return;

    lastSignature = next;
    void browser.runtime
      .sendMessage({ type: 'VIDEO_CHANGED', videoId: currentVideoId() })
      .catch(() => undefined);
  }, delay);
}

// Input events cover typing; the observer covers the "Show more" expansion and
// chips being rendered asynchronously by Studio.
document.addEventListener(
  'input',
  (event) => {
    const target = event.target as Element | null;
    if (
      target?.closest?.(
        'ytcp-video-metadata-editor, ytcp-video-metadata-editor-basics, ytcp-social-suggestions-textbox, ytcp-chip-bar, #tags-container',
      )
    ) {
      scheduleChange();
    }
  },
  true,
);

const observer = new MutationObserver(() => scheduleChange());
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

let lastHref = location.href;
window.setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    lastSignature = '';
    scheduleChange(true);
    return;
  }

  // Safety net for lazy-rendered sections (tags behind "Show more") and for
  // mutations that happen inside a shadow root the observer cannot see.
  if (isEditPage() && !document.hidden) scheduleChange();
}, 1500);

browser.runtime.onMessage.addListener(((message: unknown) => {
  if (!message || typeof message !== 'object') return undefined;

  const type = (message as { type?: string }).type;
  if (type === 'GET_STUDIO_DATA') return Promise.resolve(collect());
  if (type === 'EXPAND_STUDIO_TAGS') return expandEditor();

  if (type === 'ADD_STUDIO_TAGS') {
    const data = message as { tags?: unknown; videoId?: unknown };
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    return addStudioTags(tags, typeof data.videoId === 'string' ? data.videoId : null);
  }

  if (type === 'SET_STUDIO_TITLE') {
    const data = message as { title?: unknown; videoId?: unknown };
    return setStudioTitle(
      typeof data.title === 'string' ? data.title : '',
      typeof data.videoId === 'string' ? data.videoId : null,
    );
  }

  if (type === 'SET_STUDIO_DESCRIPTION') {
    const data = message as { description?: unknown; videoId?: unknown };
    return setStudioDescription(
      typeof data.description === 'string' ? data.description : '',
      typeof data.videoId === 'string' ? data.videoId : null,
    );
  }

  return undefined;
}) as any);

const LAUNCHER_STYLES = `
:host { all: initial; }
.ytpl-studio-launcher {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2a323d;
  border-radius: 50%;
  background: #0f1115;
  color: #22d3a6;
  font: 22px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.ytpl-studio-launcher:hover {
  border-color: #22d3a6;
  transform: translateY(-1px);
}

.ytpl-studio-hint {
  position: fixed;
  right: 18px;
  bottom: 74px;
  max-width: 260px;
  padding: 8px 10px;
  border: 1px solid #2a323d;
  border-radius: 10px;
  background: #161a21;
  color: #e8edf4;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.ytpl-studio-hint[hidden] {
  display: none;
}
`;

function mountStudioLauncher(): void {
  if (document.getElementById('ytpl-studio-launcher')) return;

  const host = document.createElement('div');
  host.id = 'ytpl-studio-launcher';
  host.style.cssText =
    'all:initial;position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483000;';

  const shadow = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(LAUNCHER_STYLES);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = LAUNCHER_STYLES;
    shadow.appendChild(style);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ytpl-studio-launcher';
  button.textContent = '◎';
  const label = `${t('studio.openPanel')} · Alt+Shift+P`;
  button.title = label;
  button.setAttribute('aria-label', label);

  const hint = document.createElement('div');
  hint.className = 'ytpl-studio-hint';
  hint.setAttribute('role', 'status');
  hint.hidden = true;

  let timer: number | undefined;
  const showHint = (message: string) => {
    hint.textContent = message;
    hint.hidden = false;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      hint.hidden = true;
    }, 6000);
  };

  button.addEventListener('click', async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'OPEN_SIDEBAR',
      })) as OpenPanelResponse | undefined;

      if (!response?.ok) {
        showHint(t('studio.openHintFail'));
      } else if (response.mode === 'window') {
        showHint(t('studio.openHintWindow'));
      } else {
        showHint(t('studio.openHintOk'));
      }
    } catch {
      showHint(t('studio.openHintFail'));
    }
  });

  shadow.appendChild(button);
  shadow.appendChild(hint);
  document.documentElement.appendChild(host);
}

mountStudioLauncher();
