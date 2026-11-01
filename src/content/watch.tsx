import { render } from 'preact';
import { PanelRoot, notifyPanelVideoChanged } from './panel';
import { panelStyles } from './panel-styles';
import { readPlayerResponseFromScripts } from '../core/player';
import { getSettings } from '../core/settings';

let host: HTMLDivElement | null = null;
let mounted = false;
let visible = false;
let lastHref = location.href;

function isWatchPage(): boolean {
  return location.pathname === '/watch' && new URLSearchParams(location.search).has('v');
}

function ensureMounted(): void {
  if (mounted) return;
  mounted = true;

  host = document.createElement('div');
  host.id = 'ytpl-host';
  host.style.cssText =
    'all:initial;position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483000;';

  const shadow = host.attachShadow({ mode: 'open' });

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(panelStyles);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = panelStyles;
    shadow.appendChild(style);
  }

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.documentElement.appendChild(host);

  render(<PanelRoot />, mountPoint);
}

async function sync(): Promise<void> {
  const settings = await getSettings();

  if (!settings.showFloatingButton || !isWatchPage()) {
    if (host) host.style.display = 'none';
    visible = false;
    return;
  }

  ensureMounted();
  visible = true;
  if (host) host.style.display = 'block';
}

function onPossibleNavigation(): void {
  if (location.href === lastHref) return;
  lastHref = location.href;

  void sync();
  if (visible) notifyPanelVideoChanged();
  void browser.runtime.sendMessage({ type: 'VIDEO_CHANGED' }).catch(() => undefined);
}

document.addEventListener('yt-navigate-finish', onPossibleNavigation, true);
window.addEventListener('popstate', onPossibleNavigation);

if (document.head) {
  const headObserver = new MutationObserver(onPossibleNavigation);
  headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
}

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') void sync();
});

browser.runtime.onMessage.addListener(((message: unknown) => {
  if (message && typeof message === 'object' && (message as { type?: string }).type === 'READ_PLAYER_RESPONSE') {
    return Promise.resolve(readPlayerResponseFromScripts());
  }
  return undefined;
}) as any);

void sync();
