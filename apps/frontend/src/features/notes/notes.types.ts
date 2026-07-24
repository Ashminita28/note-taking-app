import type { NoteSortField, SORT_ORDERS } from '@note-app/shared';

export type SortOrder = (typeof SORT_ORDERS)[number];

/** URL-search-params-backed list state — not a request/response shape, so it stays local to this feature. */
export interface NotesListParams {
  page: number;
  sortBy: NoteSortField;
  sortOrder: SortOrder;
  tagIds: string[];
  trash: boolean;
}

/** Autosave lifecycle state shown by `AutosaveStatusIndicator` — UI-only, not a data contract. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Local editor working-state snapshot used for dirty-checking — not a request/response shape. */
export interface EditorDraft {
  title: string;
  content: string;
  tagIds: string[];
}
