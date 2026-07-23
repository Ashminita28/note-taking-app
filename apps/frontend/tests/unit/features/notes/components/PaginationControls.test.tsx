import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginationControls } from '../../../../../src/features/notes/components/PaginationControls';

describe('PaginationControls', () => {
  it('renders nothing when there is a single page', () => {
    const { container } = render(
      <PaginationControls
        pagination={{ page: 1, pageSize: 20, totalItems: 5, totalPages: 1 }}
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Previous on page 1 and calls onPageChange for Next', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        pagination={{ page: 1, pageSize: 20, totalItems: 45, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Next on the last page', () => {
    render(
      <PaginationControls
        pagination={{ page: 3, pageSize: 20, totalItems: 45, totalPages: 3 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
  });
});
