import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useVersionsQuery,
  useVersionQuery,
  useRestoreVersionMutation,
} from '../../../../src/features/versions/versions.hooks';
import { getVersions, getVersion, restoreVersion } from '../../../../src/features/versions/versions.api';
import { toast } from '../../../../src/components/ui/use-toast';
import { ApiError } from '../../../../src/lib/api-client';

vi.mock('../../../../src/features/versions/versions.api', () => ({
  getVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
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

const sampleNote = {
  id: 'n1',
  title: 'Restored title',
  content: '<p>restored</p>',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('useVersionsQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the version list for a note', async () => {
    vi.mocked(getVersions).mockResolvedValue({ versions: [] });
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useVersionsQuery('n1', { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getVersions).toHaveBeenCalledWith('n1');
  });

  it('does not fetch when disabled', () => {
    const { wrapper } = createWrapperWithClient();

    renderHook(() => useVersionsQuery('n1', { enabled: false }), { wrapper });

    expect(getVersions).not.toHaveBeenCalled();
  });
});

describe('useVersionQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when versionNumber is undefined', () => {
    const { wrapper } = createWrapperWithClient();

    renderHook(() => useVersionQuery('n1', undefined), { wrapper });

    expect(getVersion).not.toHaveBeenCalled();
  });

  it('fetches the specific version once versionNumber is provided', async () => {
    vi.mocked(getVersion).mockResolvedValue({
      version: { versionNumber: 2, title: 'T', content: '<p>c</p>', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useVersionQuery('n1', 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getVersion).toHaveBeenCalledWith('n1', 2);
  });
});

describe('useRestoreVersionMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restores a version and writes the note cache + invalidates lists (BR-009)', async () => {
    vi.mocked(restoreVersion).mockResolvedValue({ note: sampleNote });
    const { wrapper, queryClient } = createWrapperWithClient();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRestoreVersionMutation('n1'), { wrapper });
    result.current.mutate(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restoreVersion).toHaveBeenCalledWith('n1', 2);
    expect(setQueryDataSpy).toHaveBeenCalledWith(['notes', 'detail', 'n1'], { note: sampleNote });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notes', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['versions', 'list', 'n1'] });
  });

  it('shows a destructive toast on failure', async () => {
    vi.mocked(restoreVersion).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const { wrapper } = createWrapperWithClient();

    const { result } = renderHook(() => useRestoreVersionMutation('n1'), { wrapper });
    result.current.mutate(2);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: 'Failed to restore version. Please try again.',
      variant: 'destructive',
    });
  });
});
