import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchQuery } from '../../../../src/features/search/search.hooks';
import { getSearchResults } from '../../../../src/features/search/search.api';

vi.mock('../../../../src/features/search/search.api', () => ({
  getSearchResults: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSearchQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled and never calls the API when q is empty', () => {
    renderHook(() => useSearchQuery({ q: '', page: 1 }), { wrapper: createWrapper() });

    expect(getSearchResults).not.toHaveBeenCalled();
  });

  it('is disabled when q is whitespace-only', () => {
    renderHook(() => useSearchQuery({ q: '   ', page: 1 }), { wrapper: createWrapper() });

    expect(getSearchResults).not.toHaveBeenCalled();
  });

  it('fetches results when q is a real query', async () => {
    vi.mocked(getSearchResults).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    const { result } = renderHook(() => useSearchQuery({ q: 'budget', page: 1 }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSearchResults).toHaveBeenCalledWith({ q: 'budget', page: 1 });
  });
});
