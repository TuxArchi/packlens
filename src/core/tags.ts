export const TAG_CHARACTER_LIMIT = 500;

// Labels that Studio renders next to or inside the tag widgets. They must never
// be treated as real tags.
const UI_LABELS = new Set([
  'add tag',
  'add tags',
  'add a tag',
  'añadir etiqueta',
  'añadir etiquetas',
  'agregar etiqueta',
  'agregar etiquetas',
  'tags',
  'etiquetas',
  'show more',
  'show less',
  'mostrar más',
  'mostrar mas',
  'mostrar menos',
  'close',
  'remove',
  'eliminar',
]);

export function cleanTag(raw: string): string | null {
  const value = raw
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!value) return null;
  if (value.length > 100) return null;
  if (UI_LABELS.has(value.toLocaleLowerCase())) return null;
  return value;
}

export function cleanTags(values: string[]): string[] {
  const cleaned: string[] = [];
  for (const value of values) {
    const tag = cleanTag(value);
    if (tag) cleaned.push(tag);
  }
  return normalizeTags(cleaned);
}

export function parseTagsFromText(text: string): string[] {
  return cleanTags(text.split(/[,\n;]+/));
}


export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }

  return result;
}

export function findDuplicates(tags: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const raw of tags) {
    const key = raw.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }

  return [...duplicates];
}

export function tagCharacters(tags: string[]): number {
  return tags.join(',').length;
}

/**
 * Returns the suggested tags that are not already present and still fit inside
 * the tag field budget. It never removes existing tags.
 */
export function fitTags(
  existing: string[],
  suggested: string[],
  limit = 480,
): string[] {
  const current = normalizeTags(existing);
  const seen = new Set(current.map((tag) => tag.toLocaleLowerCase()));
  const result: string[] = [];

  for (const raw of suggested) {
    const tag = raw.replace(/\s+/g, ' ').trim();
    if (!tag) continue;

    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    if (tagCharacters([...current, ...result, tag]) > limit) continue;

    seen.add(key);
    result.push(tag);
  }

  return result;
}

