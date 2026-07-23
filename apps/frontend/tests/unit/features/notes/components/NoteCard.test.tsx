import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NoteResponse } from '@note-app/shared';
import { NoteCard } from '../../../../../src/features/notes/components/NoteCard';

const note: NoteResponse = {
  id: 'n1',
  title: 'My Note',
  content: '<p>Hello <strong>world</strong></p>',
  tags: [{ id: 't1', name: 'Work', color: '#111111' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('NoteCard', () => {
  it('renders title, stripped preview, and tags, linking to the note', () => {
    render(
      <MemoryRouter>
        <NoteCard note={note} />
      </MemoryRouter>,
    );
    expect(screen.getByText('My Note')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notes/n1');
  });

  it('renders a Restore button instead of a link in trash view', () => {
    const onRestore = vi.fn();
    render(
      <MemoryRouter>
        <NoteCard note={note} isTrashView onRestore={onRestore} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith('n1');
  });
});
