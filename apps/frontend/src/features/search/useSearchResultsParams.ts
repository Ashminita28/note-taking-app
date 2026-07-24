import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE } from '@note-app/shared';
import type { SearchListParams } from './search.types';

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

export interface UseSearchResultsParamsResult {
  params: SearchListParams;
  setPage: (page: number) => void;
}

/** Read-only-ish URL-search-params source of truth for the `/search` route — mirrors `useNotesListParams`. */
export function useSearchResultsParams(): UseSearchResultsParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<SearchListParams>(
    () => ({
      q: searchParams.get('q') ?? '',
      page: parsePage(searchParams.get('page')),
    }),
    [searchParams],
  );

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

  return { params, setPage };
}
