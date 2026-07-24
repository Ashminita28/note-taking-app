import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getSearchResults } from '../../../../src/features/search/search.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn() },
}));

describe('search.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('getSearchResults calls apiClient with q, page, and the default pageSize', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: [], pagination: {} });

    await getSearchResults({ q: 'budget', page: 2 });

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/search?q=budget&page=2&pageSize=20' });
  });
});
