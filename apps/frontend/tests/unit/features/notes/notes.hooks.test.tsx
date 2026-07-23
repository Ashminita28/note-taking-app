import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotesListParams } from '../../../../src/features/notes/notes.types';
import { useNotesQuery, useRestoreNoteMutation } from '../../../../src/features/notes/notes.hooks';
import { getNotes, restoreNote } from '../../../../src/features/notes/notes.api';
import { toast } from '../../../../src/components/ui/use-toast';

vi.mock('../../../../src/features/notes/notes.api', () => ({
  getNotes: vi.fn(),
  restoreNote: vi.fn(),
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
