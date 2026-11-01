export function t(key: string, substitutions?: string | string[]): string {
  try {
    const message = browser.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    return key;
  }
}

export function uiLocale(): string {
  try {
    return browser.i18n.getUILanguage() || 'en';
  } catch {
    return 'en';
  }
}
