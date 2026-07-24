import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoteNotFoundState } from '../../../../../src/features/notes/components/NoteNotFoundState';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

describe('NoteNotFoundState', () => {
  it('shows a "Note not found" message with a link back to the Dashboard', () => {
    render(
      <MemoryRouter>
        <NoteNotFoundState />
      </MemoryRouter>,
    );

    expect(screen.getByText('Note not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
