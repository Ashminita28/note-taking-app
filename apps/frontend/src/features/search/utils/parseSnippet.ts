export interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

const MARK_DELIMITER = /(<mark>|<\/mark>)/;

/**
 * Splits a `ts_headline` snippet on the literal `<mark>`/`</mark>` delimiters it inserts around
 * matched terms. Everything else is returned as plain text — `ts_headline` does not HTML-escape
 * the surrounding note content (confirmed in `apps/backend/src/modules/search/search.service.ts`),
 * so callers MUST render `highlighted: false` segments as text (e.g. a React text child), never via
 * `dangerouslySetInnerHTML`, or literal `<`/`>` characters a user typed into a note become live
 * markup instead of visible text.
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let highlighted = false;

  for (const part of snippet.split(MARK_DELIMITER)) {
    if (part === '<mark>') {
      highlighted = true;
      continue;
    }
    if (part === '</mark>') {
      highlighted = false;
      continue;
    }
    if (part === '') {
      continue;
    }
    segments.push({ text: part, highlighted });
  }

  return segments;
}
