import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSharesQuery,
  useCreateShareMutation,
  useRevokeShareMutation,
  useSharedNoteQuery,
} from '../../../../src/features/share/share.hooks';
import { getShares, createShare, revokeShare, getSharedNote } from '../../../../src/features/share/share.api';
import { toast } from '../../../../src/components/ui/use-toast';
import { ApiError } from '../../../../src/lib/api-client';

vi.mock('../../../../src/features/share/share.api', () => ({
  getShares: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
  getSharedNote: vi.fn(),
}));

vi.mock('../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

function createWrapperWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

const sampleShareLink = {
  token: 'tok1',
  url: 'https://app.test/shared/tok1',
  expiresAt: '2026-08-01T00:00:00.000Z',
  viewCount: 0,
  createdAt: '2026-07-24T00:00:00.000Z',
};

describe('useSharesQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the active shares list', async () => {
    vi.mocked(getShares).mockResolvedValue({ shares: [] });
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useSharesQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getShares).toHaveBeenCalled();
  });
});

describe('useCreateShareMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a share link and invalidates the note detail + shares list caches', async () => {
    vi.mocked(createShare).mockResolvedValue({ shareLink: sampleShareLink });
    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateShareMutation('n1'), { wrapper });
    result.current.mutate({ expiresInHours: 24 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createShare).toHaveBeenCalledWith('n1', { expiresInHours: 24 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notes', 'detail', 'n1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['shares', 'list'] });
  });

  it('shows a destructive toast on failure', async () => {
    vi.mocked(createShare).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useCreateShareMutation('n1'), { wrapper });
    result.current.mutate({});

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({ description: 'Failed to generate share link.', variant: 'destructive' });
  });
});

describe('useRevokeShareMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('revokes the share link and invalidates the note detail + shares list caches', async () => {
    vi.mocked(revokeShare).mockResolvedValue({ message: 'Share link revoked successfully.' });
    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRevokeShareMutation('n1'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeShare).toHaveBeenCalledWith('n1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notes', 'detail', 'n1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['shares', 'list'] });
  });

  it('shows a destructive toast on failure', async () => {
    vi.mocked(revokeShare).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useRevokeShareMutation('n1'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: 'Failed to revoke share link. Please try again.',
      variant: 'destructive',
    });
  });
});

describe('useSharedNoteQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the public shared note by token', async () => {
    vi.mocked(getSharedNote).mockResolvedValue({
      note: { title: 'Shared', content: '<p>hi</p>', authorName: 'Jane', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useSharedNoteQuery('tok1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSharedNote).toHaveBeenCalledWith('tok1');
  });

  it('does not retry a 404', async () => {
    vi.mocked(getSharedNote).mockRejectedValue(new ApiError(404, 'SHARE_LINK_NOT_FOUND', 'Not found.'));
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useSharedNoteQuery('missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getSharedNote).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 410', async () => {
    vi.mocked(getSharedNote).mockRejectedValue(new ApiError(410, 'SHARE_LINK_EXPIRED', 'Expired.'));
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useSharedNoteQuery('expired'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getSharedNote).toHaveBeenCalledTimes(1);
  });
});
