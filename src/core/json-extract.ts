/**
 * YouTube embeds its bootstrap state as `var ytInitialPlayerResponse = {...};`
 * inside a <script> tag. The value is a JSON literal, so we can locate the
 * opening brace and walk to its matching closing brace while respecting
 * strings and escapes. This avoids brittle regular expressions.
 */
export function extractJsonObject(source: string, marker: string): unknown | null {
  const markerAt = source.indexOf(marker);
  if (markerAt === -1) return null;

  const start = source.indexOf('{', markerAt + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
