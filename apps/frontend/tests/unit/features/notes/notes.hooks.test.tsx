import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotesListParams } from '../../../../src/features/notes/notes.types';
import {
  useNotesQuery,
  useRestoreNoteMutation,
  useNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '../../../../src/features/notes/notes.hooks';
import {
  getNotes,
  restoreNote,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../../../../src/features/notes/notes.api';
import { toast } from '../../../../src/components/ui/use-toast';
import { ApiError } from '../../../../src/lib/api-client';

vi.mock('../../../../src/features/notes/notes.api', () => ({
  getNotes: vi.fn(),
  restoreNote: vi.fn(),
  getNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

const params: NotesListParams = { page: 1, sortBy: 'updatedAt', sortOrder: 'desc', tagIds: [], trash: false };

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

const sampleNote = {
  id: 'n1',
  title: 'Sample',
  content: '<p>hi</p>',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useNotesQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches notes via getNotes with the given params', async () => {
    vi.mocked(getNotes).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    const { result } = renderHook(() => useNotesQuery(params), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNotes).toHaveBeenCalledWith(params);
  });
});

describe('useRestoreNoteMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls restoreNote and shows a "Note restored" toast on success', async () => {
    vi.mocked(restoreNote).mockResolvedValue({
      note: {
        id: 'n1',
        title: 'Restored',
        content: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const { result } = renderHook(() => useRestoreNoteMutation(), { wrapper: createWrapper() });
    result.current.mutate('n1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restoreNote).toHaveBeenCalledWith('n1');
    expect(toast).toHaveBeenCalledWith({ description: 'Note restored' });
  });
});

describe('useNoteQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a note by id when enabled', async () => {
    vi.mocked(getNote).mockResolvedValue({ note: sampleNote });

    const { result } = renderHook(() => useNoteQuery('n1', { enabled: true }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNote).toHaveBeenCalledWith('n1');
  });

  it('does not fetch when disabled (new-note mode)', () => {
    const { result } = renderHook(() => useNoteQuery('new', { enabled: false }), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getNote).not.toHaveBeenCalled();
  });

  it('does not retry a 404 — shows "Note not found" immediately instead of after backoff (Scenario 3)', async () => {
    vi.mocked(getNote).mockRejectedValue(new ApiError(404, 'NOTE_NOT_FOUND', 'Note not found.'));

    const { result } = renderHook(() => useNoteQuery('missing', { enabled: true }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getNote).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateNoteMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a note and primes the detail cache', async () => {
    vi.mocked(createNote).mockResolvedValue({ note: sampleNote });
    const { wrapper, queryClient } = createWrapperWithClient();

    const { result } = renderHook(() => useCreateNoteMutation(), { wrapper });
    result.current.mutate({ title: 'Sample', content: '<p>hi</p>' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createNote).toHaveBeenCalledWith({ title: 'Sample', content: '<p>hi</p>' });
    expect(queryClient.getQueryData(['notes', 'detail', 'n1'])).toEqual({ note: sampleNote });
  });
});

describe('useUpdateNoteMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates a note and refreshes the detail cache', async () => {
    vi.mocked(updateNote).mockResolvedValue({ note: sampleNote });
    const { wrapper, queryClient } = createWrapperWithClient();

    const { result } = renderHook(() => useUpdateNoteMutation('n1'), { wrapper });
    result.current.mutate({ title: 'Sample' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateNote).toHaveBeenCalledWith('n1', { title: 'Sample' });
    expect(queryClient.getQueryData(['notes', 'detail', 'n1'])).toEqual({ note: sampleNote });
  });
});

describe('useDeleteNoteMutation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a note and invalidates the notes/tags/shares list caches', async () => {
    vi.mocked(deleteNote).mockResolvedValue({ message: 'Note deleted successfully.' });
    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteNoteMutation(), { wrapper });
    result.current.mutate('n1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteNote).toHaveBeenCalledWith('n1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notes', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 'list'] });
    // BR-014: soft-delete auto-revokes the note's share link server-side, so the Share dialog's
    // cached list must be invalidated too or it keeps showing the now-dead link (AB-1016 finding).
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['shares', 'list'] });
  });
});
