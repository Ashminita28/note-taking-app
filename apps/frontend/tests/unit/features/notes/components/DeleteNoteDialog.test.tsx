import { useRef, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteNoteDialog } from '../../../../../src/features/notes/components/DeleteNoteDialog';
import { useDeleteNoteMutation, useRestoreNoteMutation } from '../../../../../src/features/notes/notes.hooks';
import { toast } from '../../../../../src/components/ui/use-toast';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../../src/features/notes/notes.hooks', () => ({
  useDeleteNoteMutation: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
}));

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

describe('DeleteNoteDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults initial focus to "Cancel", not "Delete" (UX-NOTE-03)', () => {
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);

    render(<DeleteNoteDialog noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('cancel closes without calling delete', () => {
    const deleteMutate = vi.fn();
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);
    const onOpenChange = vi.fn();

    render(<DeleteNoteDialog noteId="n1" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it('confirming delete navigates home and shows an Undo toast', () => {
    const deleteMutate = vi.fn((_id: string, options: { onSuccess: () => void }) => options.onSuccess());
    const restoreMutate = vi.fn();
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: restoreMutate,
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);
    const onOpenChange = vi.fn();

    render(<DeleteNoteDialog noteId="n1" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));

    expect(deleteMutate).toHaveBeenCalledWith('n1', expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Note moved to trash.',
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );

    const toastCall = vi.mocked(toast).mock.calls[0][0] as { action: { onClick: () => void } };
    toastCall.action.onClick();
    expect(restoreMutate).toHaveBeenCalledWith('n1');
  });

  it('shows a toast and closes the dialog without navigating when delete fails (Scenario 28)', () => {
    const deleteMutate = vi.fn((_id: string, options: { onError: () => void }) => options.onError());
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);
    const onOpenChange = vi.fn();

    render(<DeleteNoteDialog noteId="n1" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Failed to delete note. Please try again.', variant: 'destructive' }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('uses role="dialog" (not alertdialog), matching UX §8.8 and spec Scenario 23', () => {
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);

    render(<DeleteNoteDialog noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('restores focus to the triggering element after Cancel (SDS §15.4 Rule 2)', async () => {
    vi.mocked(useDeleteNoteMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNoteMutation>);
    vi.mocked(useRestoreNoteMutation).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRestoreNoteMutation>);

    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} onClick={() => setOpen(true)}>
            Open trigger
          </button>
          <DeleteNoteDialog noteId="n1" open={open} onOpenChange={setOpen} returnFocusRef={triggerRef} />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
