import { DEFAULT_PAGE_SIZE } from '@note-app/shared';
import type { SearchResponse } from '@note-app/shared';
import { apiClient } from '../../lib/api-client';
import type { SearchListParams } from './search.types';

export function getSearchResults(params: SearchListParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.q,
    page: String(params.page),
    pageSize: String(DEFAULT_PAGE_SIZE),
  });
  return apiClient.request({ path: `/search?${searchParams}` });
}
