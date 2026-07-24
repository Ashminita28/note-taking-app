import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptySearchState } from '../../../../../src/features/search/components/EmptySearchState';

describe('EmptySearchState', () => {
  it('renders the query as visible text', () => {
    render(<EmptySearchState query="nonexistentterm" />);

    expect(screen.getByText('No notes found for "nonexistentterm"')).toBeInTheDocument();
    expect(screen.getByText('Try different keywords or check spelling')).toBeInTheDocument();
  });

  it('renders a literal query containing special characters as plain text, not markup', () => {
    render(<EmptySearchState query="<script>" />);

    expect(screen.getByText('No notes found for "<script>"')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
