import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchResultsList } from '../../../../../src/features/search/components/SearchResultsList';
import { useSearchQuery } from '../../../../../src/features/search/search.hooks';

vi.mock('../../../../../src/features/search/search.hooks', () => ({
  useSearchQuery: vi.fn(),
}));

const baseParams = { q: 'budget', page: 1 };

function renderList(params = baseParams) {
  return render(
    <MemoryRouter>
      <SearchResultsList params={params} />
    </MemoryRouter>,
  );
}

describe('SearchResultsList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton cards while loading', () => {
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSearchQuery>);

    renderList();

    expect(screen.getByLabelText('Searching')).toBeInTheDocument();
  });

  it('shows a retry banner on error and refetches on click', () => {
    const refetch = vi.fn();
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useSearchQuery>);

    renderList();
    expect(screen.getByText('Search unavailable. Please try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('shows the empty state with the query interpolated when there are no results', () => {
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSearchQuery>);

    renderList({ q: 'nonexistentterm', page: 1 });

    expect(screen.getByText('No notes found for "nonexistentterm"')).toBeInTheDocument();
  });

  it('announces the result count via an aria-live region', () => {
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { id: 'n1', title: 'Note 1', snippet: 'a snippet', rank: 0.5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSearchQuery>);

    renderList();

    expect(screen.getByText('1 results found')).toBeInTheDocument();
  });

  it('renders a result item per result and moves focus on ArrowDown/ArrowUp', () => {
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { id: 'n1', title: 'Note 1', snippet: 'a', rank: 0.5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'n2', title: 'Note 2', snippet: 'b', rank: 0.4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSearchQuery>);

    renderList();

    const items = screen.getAllByRole('link');
    expect(items).toHaveLength(2);

    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });
});
