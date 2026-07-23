import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE, DEFAULT_SORT_BY, DEFAULT_SORT_ORDER, NOTE_SORT_FIELDS, SORT_ORDERS } from '@note-app/shared';
import type { NoteSortField } from '@note-app/shared';
import type { NotesListParams, SortOrder } from './notes.types';

const SORT_FIELDS: readonly string[] = NOTE_SORT_FIELDS;
const ORDERS: readonly string[] = SORT_ORDERS;

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parseSortBy(value: string | null): NoteSortField {
  return value !== null && SORT_FIELDS.includes(value) ? (value as NoteSortField) : DEFAULT_SORT_BY;
}

function parseSortOrder(value: string | null): SortOrder {
  return value !== null && ORDERS.includes(value) ? (value as SortOrder) : DEFAULT_SORT_ORDER;
}

export interface UseNotesListParamsResult {
  params: NotesListParams;
  setPage: (page: number) => void;
  setSort: (sortBy: NoteSortField, sortOrder: SortOrder) => void;
  toggleTag: (tagId: string) => void;
  setTrash: (trash: boolean) => void;
}

/** Single source of truth for Dashboard list-control state — lives in the URL, not a store (plan.md Decision 1). */
export function useNotesListParams(): UseNotesListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<NotesListParams>(() => {
    const tagIdsRaw = searchParams.get('tagIds');
    return {
      page: parsePage(searchParams.get('page')),
      sortBy: parseSortBy(searchParams.get('sortBy')),
      sortOrder: parseSortOrder(searchParams.get('sortOrder')),
      tagIds: tagIdsRaw ? tagIdsRaw.split(',').filter(Boolean) : [],
      trash: searchParams.get('trash') === '1',
    };
  }, [searchParams]);

  const setPage = useCallback(
    (page: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', String(page));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (sortBy: NoteSortField, sortOrder: SortOrder) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('sortBy', sortBy);
          next.set('sortOrder', sortOrder);
          next.set('page', String(DEFAULT_PAGE));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current = (next.get('tagIds') ?? '').split(',').filter(Boolean);
          const updated = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];

          if (updated.length > 0) {
            next.set('tagIds', updated.join(','));
          } else {
            next.delete('tagIds');
          }
          next.set('page', String(DEFAULT_PAGE));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTrash = useCallback(
    (trash: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trash) {
            next.set('trash', '1');
          } else {
            next.delete('trash');
          }
          next.set('page', String(DEFAULT_PAGE));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { params, setPage, setSort, toggleTag, setTrash };
}
