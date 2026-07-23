import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortDropdown } from '../../../../../src/features/notes/components/SortDropdown';

describe('SortDropdown', () => {
  it('shows the active sort label on the trigger', () => {
    render(<SortDropdown sortBy="title" sortOrder="asc" onChange={vi.fn()} />);
    expect(screen.getByText('Sort: Title A–Z')).toBeInTheDocument();
  });

  it('calls onChange with the selected combination', () => {
    const onChange = vi.fn();
    render(<SortDropdown sortBy="updatedAt" sortOrder="desc" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Sort notes' }), { key: 'Enter' });
    fireEvent.click(screen.getByText('Oldest created'));

    expect(onChange).toHaveBeenCalledWith('createdAt', 'asc');
  });
});
