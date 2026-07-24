import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { useSearchQuery } from '../search.hooks';
import type { SearchListParams } from '../search.types';
import { SEARCH_RESULTS_SKELETON_COUNT } from '../search.constants';
import { EmptySearchState } from './EmptySearchState';
import { SearchResultItem } from './SearchResultItem';
import { SearchResultSkeleton } from './SearchResultSkeleton';

interface SearchResultsListProps {
  params: SearchListParams;
}

export function SearchResultsList({ params }: SearchResultsListProps) {
  const { data, isLoading, isError, refetch } = useSearchQuery(params);
  const listRef = useRef<HTMLUListElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-search-result]') ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) {
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
    items[Math.max(0, Math.min(items.length - 1, nextIndex))]?.focus();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Searching">
        {Array.from({ length: SEARCH_RESULTS_SKELETON_COUNT }).map((_, index) => (
          <SearchResultSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 p-8 text-center"
      >
        <p className="text-sm text-destructive">Search unavailable. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const results = data?.data ?? [];

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {results.length} results found
      </div>
      {results.length === 0 ? (
        <EmptySearchState query={params.q} />
      ) : (
        <ul ref={listRef} onKeyDown={handleKeyDown} className="flex flex-col gap-3" aria-label="Search results">
          {results.map((result) => (
            <li key={result.id}>
              <SearchResultItem result={result} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
