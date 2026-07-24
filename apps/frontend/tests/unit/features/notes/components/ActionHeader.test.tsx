import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActionHeader } from '../../../../../src/features/notes/components/ActionHeader';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../../src/features/notes/components/DeleteNoteDialog', () => ({
  DeleteNoteDialog: () => <div data-testid="delete-dialog-stub" />,
}));

function openMoreMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), { key: 'Enter' });
}

describe('ActionHeader', () => {
  it('back button navigates to the Dashboard', () => {
    render(
      <MemoryRouter>
        <ActionHeader noteId="n1" title="My note" onTitleChange={vi.fn()} status="idle" canDelete />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('calls onTitleChange as the title input changes, respecting the max length', () => {
    const onTitleChange = vi.fn();
    render(
      <MemoryRouter>
        <ActionHeader noteId="n1" title="My note" onTitleChange={onTitleChange} status="idle" canDelete />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText('Note title') as HTMLInputElement;
    expect(input.maxLength).toBe(255);
    fireEvent.change(input, { target: { value: 'Updated title' } });
    expect(onTitleChange).toHaveBeenCalledWith('Updated title');
  });

  it('disables Share and History when their handlers are not provided', () => {
    render(
      <MemoryRouter>
        <ActionHeader noteId="n1" title="My note" onTitleChange={vi.fn()} status="idle" canDelete />
      </MemoryRouter>,
    );

    openMoreMenu();
    expect(screen.getByText('Share').closest('[role="menuitem"]')).toHaveAttribute('data-disabled');
    expect(screen.getByText('History').closest('[role="menuitem"]')).toHaveAttribute('data-disabled');
  });

  it('enables Share and History once handlers are provided', () => {
    const onShare = vi.fn();
    const onHistory = vi.fn();
    render(
      <MemoryRouter>
        <ActionHeader
          noteId="n1"
          title="My note"
          onTitleChange={vi.fn()}
          status="idle"
          canDelete
          onShare={onShare}
          onHistory={onHistory}
        />
      </MemoryRouter>,
    );

    openMoreMenu();
    fireEvent.click(screen.getByText('Share'));
    expect(onShare).toHaveBeenCalled();
  });

  it('places initial focus in the title field when autoFocusTitle is set (UX-NOTE-01)', () => {
    render(
      <MemoryRouter>
        <ActionHeader noteId="new" title="" onTitleChange={vi.fn()} status="idle" canDelete={false} autoFocusTitle />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Note title')).toHaveFocus();
  });

  it('does not steal focus from the title field for an existing note', () => {
    render(
      <MemoryRouter>
        <ActionHeader noteId="n1" title="My note" onTitleChange={vi.fn()} status="idle" canDelete />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Note title')).not.toHaveFocus();
  });

  it('passes errorMessage through to the autosave indicator (Scenario 12)', () => {
    render(
      <MemoryRouter>
        <ActionHeader
          noteId="n1"
          title="My note"
          onTitleChange={vi.fn()}
          status="error"
          errorMessage="This note is too large to save."
          canDelete
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('This note is too large to save.')).toBeInTheDocument();
  });

  it('does not render the delete dialog when the note has not been created yet (canDelete=false)', () => {
    render(
      <MemoryRouter>
        <ActionHeader noteId="new" title="" onTitleChange={vi.fn()} status="idle" canDelete={false} />
      </MemoryRouter>,
    );

    openMoreMenu();
    expect(screen.getByText('Move to trash').closest('[role="menuitem"]')).toHaveAttribute('data-disabled');
    expect(screen.queryByTestId('delete-dialog-stub')).not.toBeInTheDocument();
  });
});
