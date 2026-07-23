import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NotesListParams } from '../../../../../src/features/notes/notes.types';
import { NotesList } from '../../../../../src/features/notes/components/NotesList';
import { useNotesQuery, useRestoreNoteMutation } from '../../../../../src/features/notes/notes.hooks';

vi.mock('../../../../../src/features/notes/notes.hooks', () => ({
  useNotesQuery: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
}));

const baseParams: NotesListParams = {
  page: 1,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  tagIds: [],
  trash: false,
};

function mockRestoreMutation() {
  vi.mocked(useRestoreNoteMutation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useRestoreNoteMutation>);
}

function renderList(params: NotesListParams = baseParams) {
  return render(
    <MemoryRouter>
      <NotesList params={params} />
    </MemoryRouter>,
  );
}

describe('NotesList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton cards while loading', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();

    expect(screen.getByLabelText('Loading notes')).toBeInTheDocument();
  });

  it('shows a retry banner on error and refetches on click', () => {
    mockRestoreMutation();
    const refetch = vi.fn();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('shows the no-notes empty state when there are no notes and no filter', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();

    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('shows the no-tag-match empty state when a tag filter yields nothing', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList({ ...baseParams, tagIds: ['t1'] });

    expect(screen.getByText('No notes with this tag')).toBeInTheDocument();
  });

  it('shows the empty-trash state in trash view', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList({ ...baseParams, trash: true });

    expect(screen.getByText('Trash is empty')).toBeInTheDocument();
  });

  it('moves focus between note cards on ArrowDown/ArrowUp', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'n1',
            title: 'Note 1',
            content: '',
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'n2',
            title: 'Note 2',
            content: '',
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();

    const cards = screen.getAllByRole('link');
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[1]);

    fireEvent.keyDown(cards[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(cards[0]);
  });

  it('ignores non-arrow keys and arrow keys when no card is focused', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'n1',
            title: 'Note 1',
            content: '',
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();

    const list = screen.getByRole('list', { name: 'Notes' });
    fireEvent.keyDown(list, { key: 'Enter' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });

    expect(document.activeElement).not.toBe(screen.getByRole('link'));
  });

  it('renders a note card per result', () => {
    mockRestoreMutation();
    vi.mocked(useNotesQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'n1',
            title: 'Note 1',
            content: '',
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotesQuery>);

    renderList();

    expect(screen.getByText('Note 1')).toBeInTheDocument();
  });
});
