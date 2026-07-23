import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TagWithCount } from '@note-app/shared';
import { TagChip } from '../../../../../src/features/tags/components/TagChip';

const tag: TagWithCount = { id: 't1', name: 'Work', color: '#FF5733', noteCount: 3 };

describe('TagChip', () => {
  it('renders the tag name and note count', () => {
    render(<TagChip tag={tag} selected={false} onToggle={vi.fn()} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('reflects selected state via aria-pressed and calls onToggle with the tag id', () => {
    const onToggle = vi.fn();
    render(<TagChip tag={tag} selected onToggle={onToggle} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('is disabled and exposes aria-disabled when disabled', () => {
    render(<TagChip tag={tag} selected={false} disabled onToggle={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
