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
