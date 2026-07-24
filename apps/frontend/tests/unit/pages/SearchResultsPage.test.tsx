import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchResultsPage } from '../../../src/pages/SearchResultsPage';
import { useSearchQuery } from '../../../src/features/search/search.hooks';

vi.mock('../../../src/features/search/search.hooks', () => ({
  useSearchQuery: vi.fn(),
}));

describe('SearchResultsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('composes the skip link, header, and search results list', () => {
    vi.mocked(useSearchQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSearchQuery>);

    render(
      <MemoryRouter initialEntries={['/search?q=nonexistentterm']}>
        <SearchResultsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('No notes found for "nonexistentterm"')).toBeInTheDocument();
  });
});
