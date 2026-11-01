export interface Settings {
  apiKey: string;
  showFloatingButton: boolean;
  keywordMode: 'api' | 'session';
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  showFloatingButton: true,
  keywordMode: 'api',
};

export async function getSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.sync.get(DEFAULT_SETTINGS);
    return {
      apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
      showFloatingButton: stored.showFloatingButton !== false,
      keywordMode: stored.keywordMode === 'session' ? 'session' : 'api',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.sync.set(patch);
}
