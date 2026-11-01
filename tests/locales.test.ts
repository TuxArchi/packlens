import { describe, expect, it } from 'vitest';
import en from '../public/_locales/en/messages.json';
import es from '../public/_locales/es/messages.json';

describe('locales', () => {
  it('define the same keys in every locale', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty messages', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.message, key).toBeTruthy();
    }
    for (const [key, value] of Object.entries(es)) {
      expect(value.message, key).toBeTruthy();
    }
  });

  it('do not leave untranslated placeholders in Spanish', () => {
    const shared = new Set([
      'extName',
      'ui.tabPackaging',
      'ui.tabTags',
      'ui.tabSeo',
      'metric.noData',
      'metric.tags',
      'seo.sectionTags',
      'check.seoDescriptionHashtags.name',
      'panel.tagsTitle',
      'tags.heading',
      'tags.count',
      'keywords.modeApi',
      'license.planPro',
      'description.scoreChange',
    ]);

    for (const [key, value] of Object.entries(es)) {
      if (shared.has(key)) continue;
      expect(value.message, key).not.toBe((en as Record<string, { message: string }>)[key]?.message);
    }
  });
});
