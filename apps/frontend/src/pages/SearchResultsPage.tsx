import { DashboardHeader } from '../components/layout/DashboardHeader';
import { SkipLink } from '../components/layout/SkipLink';
import { PaginationControls } from '../features/notes/components/PaginationControls';
import { SearchResultsList } from '../features/search/components/SearchResultsList';
import { useSearchQuery } from '../features/search/search.hooks';
import { useSearchResultsParams } from '../features/search/useSearchResultsParams';

export function SearchResultsPage() {
  const { params, setPage } = useSearchResultsParams();
  const { data } = useSearchQuery(params);

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <DashboardHeader />
      <main id="main-content" className="flex-1 p-6">
        <SearchResultsList params={params} />
        {data && <PaginationControls pagination={data.pagination} onPageChange={setPage} />}
      </main>
    </div>
  );
}
