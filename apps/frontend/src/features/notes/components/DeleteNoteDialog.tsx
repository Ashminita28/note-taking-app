import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/use-toast';
import { useDeleteNoteMutation, useRestoreNoteMutation } from '../notes.hooks';

interface DeleteNoteDialogProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus to on close (SDS §15.4 Rule 2). This dialog is opened from a
   *  DropdownMenuItem, not a `DialogTrigger`, so Radix has no trigger ref of its own to focus —
   *  without this, focus would fall back to `<body>` on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** UX §8.8: initial focus on "Cancel" (first focusable element), confirm → delete → toast + Undo. */
export function DeleteNoteDialog({ noteId, open, onOpenChange, returnFocusRef }: DeleteNoteDialogProps) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteNoteMutation();
  const restoreMutation = useRestoreNoteMutation();

  function handleConfirm(): void {
    deleteMutation.mutate(noteId, {
      onSuccess: () => {
        onOpenChange(false);
        navigate('/');
        toast({
          description: 'Note moved to trash.',
          action: {
            label: 'Undo',
            onClick: () => restoreMutation.mutate(noteId),
          },
        });
      },
      onError: () => {
        // Spec Scenario 28: closes without navigating away — the note remains in the editor unchanged.
        onOpenChange(false);
        toast({ description: 'Failed to delete note. Please try again.', variant: 'destructive' });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Move to trash?</DialogTitle>
          <DialogDescription>This note will be moved to trash and can be restored for 30 days.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="default" isLoading={deleteMutation.isPending} onClick={handleConfirm}>
            Move to trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
