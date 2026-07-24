import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewCounterBadge } from '../../../../../src/features/share/components/ViewCounterBadge';

describe('ViewCounterBadge', () => {
  it('renders singular "view" for a count of 1', () => {
    render(<ViewCounterBadge viewCount={1} />);
    expect(screen.getByText('1 view')).toBeInTheDocument();
  });

  it('renders plural "views" for any other count', () => {
    render(<ViewCounterBadge viewCount={12} />);
    expect(screen.getByText('12 views')).toBeInTheDocument();
  });

  it('renders "0 views" when there are no views yet', () => {
    render(<ViewCounterBadge viewCount={0} />);
    expect(screen.getByText('0 views')).toBeInTheDocument();
  });
});
