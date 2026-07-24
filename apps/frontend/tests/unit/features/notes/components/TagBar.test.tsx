import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagBar } from '../../../../../src/features/notes/components/TagBar';

vi.mock('../../../../../src/features/notes/components/TagCombobox', () => ({
  TagCombobox: ({ onSelect }: { onSelect: (tag: { id: string; name: string; color: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 't2', name: 'Personal', color: '#222222' })}>
      Add tag
    </button>
  ),
}));

describe('TagBar', () => {
  it('renders only the add-tag control when there are no tags (BR-004)', () => {
    render(<TagBar tags={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Add tag')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove tag/ })).not.toBeInTheDocument();
  });

  it('renders a chip per tag and removes one on click', () => {
    const onChange = vi.fn();
    render(
      <TagBar
        tags={[
          { id: 't1', name: 'Work', color: '#111111' },
          { id: 't2', name: 'Personal', color: '#222222' },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Work' }));

    expect(onChange).toHaveBeenCalledWith([{ id: 't2', name: 'Personal', color: '#222222' }]);
  });

  it('adds a tag selected from the combobox', () => {
    const onChange = vi.fn();
    render(<TagBar tags={[{ id: 't1', name: 'Work', color: '#111111' }]} onChange={onChange} />);

    fireEvent.click(screen.getByText('Add tag'));

    expect(onChange).toHaveBeenCalledWith([
      { id: 't1', name: 'Work', color: '#111111' },
      { id: 't2', name: 'Personal', color: '#222222' },
    ]);
  });
});
