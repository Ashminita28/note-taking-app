import type { NotesListParams } from './notes.types';

/**
 * Note `content` is server-sanitized HTML (SDS §23.4 whitelist) before it ever reaches the client,
 * so parsing it purely to read back `textContent` for a preview is safe.
 */
export function stripHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** Trash view is not tag-filterable (spec.md Decision 2) — `tagIds` is omitted whenever `trash` is true. */
export function buildNotesQuery(params: NotesListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  searchParams.set('sortBy', params.sortBy);
  searchParams.set('sortOrder', params.sortOrder);

  if (params.trash) {
    searchParams.set('includeTrashed', 'true');
  } else if (params.tagIds.length > 0) {
    searchParams.set('tagIds', params.tagIds.join(','));
  }

  return searchParams.toString();
}
