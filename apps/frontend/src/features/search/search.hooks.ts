import { useQuery } from '@tanstack/react-query';
import { SEARCH_QUERY_MIN_LENGTH } from '@note-app/shared';
import type { SearchResponse } from '@note-app/shared';
import { getSearchResults } from './search.api';
import type { SearchListParams } from './search.types';

export function useSearchQuery(params: SearchListParams) {
  return useQuery<SearchResponse>({
    queryKey: ['search', params],
    queryFn: () => getSearchResults(params),
    enabled: params.q.trim().length >= SEARCH_QUERY_MIN_LENGTH,
  });
}
