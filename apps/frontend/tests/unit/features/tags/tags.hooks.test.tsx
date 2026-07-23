import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTagsQuery } from '../../../../src/features/tags/tags.hooks';
import { getTags } from '../../../../src/features/tags/tags.api';

vi.mock('../../../../src/features/tags/tags.api', () => ({
  getTags: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTagsQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tags via getTags', async () => {
    vi.mocked(getTags).mockResolvedValue({ tags: [] });

    const { result } = renderHook(() => useTagsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTags).toHaveBeenCalled();
  });
});
