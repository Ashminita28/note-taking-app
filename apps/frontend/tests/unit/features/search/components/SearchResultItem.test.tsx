import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SearchResult } from '@note-app/shared';
import { SearchResultItem } from '../../../../../src/features/search/components/SearchResultItem';

const result: SearchResult = {
  id: 'n1',
  title: 'Weekly Standup Notes',
  snippet: 'the <mark>standup</mark> covered progress',
  rank: 0.6,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SearchResultItem', () => {
  it('renders the title, highlighted snippet, and links to the note', () => {
    render(
      <MemoryRouter>
        <SearchResultItem result={result} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Weekly Standup Notes')).toBeInTheDocument();
    expect(screen.getByText('standup').tagName).toBe('MARK');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notes/n1');
  });

  it('exposes a data-search-result attribute for keyboard navigation', () => {
    render(
      <MemoryRouter>
        <SearchResultItem result={result} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('data-search-result');
  });
});
