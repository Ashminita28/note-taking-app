import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../../src/pages/DashboardPage';
import { useNotesQuery, useRestoreNoteMutation } from '../../../src/features/notes/notes.hooks';
import { useTagsQuery } from '../../../src/features/tags/tags.hooks';
import { useAuthStore } from '../../../src/stores/auth.store';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../src/features/notes/notes.hooks', () => ({
  useNotesQuery: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
}));

vi.mock('../../../src/features/tags/tags.hooks', () => ({
  useTagsQuery: vi.fn(),
}));

function mockEmptyDashboardData() {
  vi.mocked(useNotesQuery).mockReturnValue({
    isLoading: false,
    isError: false,
    data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNotesQuery>);
  vi.mocked(useRestoreNoteMutation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useRestoreNoteMutation>);
  vi.mocked(useTagsQuery).mockReturnValue({
    isLoading: false,
    isError: false,
    data: { tags: [] },
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTagsQuery>);
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('composes the skip link, header, sidebar, and notes list', () => {
    mockEmptyDashboardData();
    useAuthStore.getState().setUser({ id: 'u1', name: 'Ada', email: 'ada@example.com' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('navigates to /notes/new on Ctrl+N', () => {
    mockEmptyDashboardData();

    render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    expect(navigateMock).toHaveBeenCalledWith('/notes/new');
  });

  it('does not trigger the Ctrl+N shortcut while focus is in an input', () => {
    mockEmptyDashboardData();

    render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n', ctrlKey: true });

    expect(navigateMock).not.toHaveBeenCalledWith('/notes/new');
    document.body.removeChild(input);
  });
});
