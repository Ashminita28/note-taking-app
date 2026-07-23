import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrashToggle } from '../../../../../src/features/notes/components/TrashToggle';

describe('TrashToggle', () => {
  it('shows "Trash" and calls onChange(true) when inactive', () => {
    const onChange = vi.fn();
    render(<TrashToggle trash={false} onChange={onChange} />);

    const button = screen.getByRole('button', { name: 'Trash' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows "Back to notes" and calls onChange(false) when active', () => {
    const onChange = vi.fn();
    render(<TrashToggle trash onChange={onChange} />);

    const button = screen.getByRole('button', { name: 'Back to notes' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
