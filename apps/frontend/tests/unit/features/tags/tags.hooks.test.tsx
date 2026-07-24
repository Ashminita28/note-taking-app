import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ERROR_CODES } from '@note-app/shared';
import { useTagsQuery, useCreateTagMutation } from '../../../../src/features/tags/tags.hooks';
import { getTags, createTag } from '../../../../src/features/tags/tags.api';
import { ApiError } from '../../../../src/lib/api-client';

vi.mock('../../../../src/features/tags/tags.api', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createWrapperWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
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

describe('useCreateTagMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new tag', async () => {
    vi.mocked(createTag).mockResolvedValue({
      tag: { id: 't1', name: 'Work', color: '#6B7280', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    });

    const { result } = renderHook(() => useCreateTagMutation(), { wrapper: createWrapper() });
    result.current.mutate({ name: 'Work' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 't1', name: 'Work', color: '#6B7280' });
  });

  it('silently reuses the existing tag on a 409 TAG_NAME_EXISTS conflict', async () => {
    vi.mocked(createTag).mockRejectedValue(new ApiError(409, ERROR_CODES.TAG_NAME_EXISTS, 'Tag name already exists.'));
    const { wrapper, queryClient } = createWrapperWithClient();
    queryClient.setQueryData(['tags', 'list'], {
      tags: [{ id: 't-existing', name: 'Work', color: '#6B7280', noteCount: 2 }],
    });

    const { result } = renderHook(() => useCreateTagMutation(), { wrapper });
    result.current.mutate({ name: 'work' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 't-existing', name: 'Work', color: '#6B7280' });
  });

  it('rethrows non-conflict errors', async () => {
    vi.mocked(createTag).mockRejectedValue(new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Boom'));

    const { result } = renderHook(() => useCreateTagMutation(), { wrapper: createWrapper() });
    result.current.mutate({ name: 'Work' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
