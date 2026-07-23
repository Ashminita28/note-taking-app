import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { useNotesQuery, useRestoreNoteMutation } from '../notes.hooks';
import type { NotesListParams } from '../notes.types';
import { EmptyNotesState } from './EmptyNotesState';
import { NoteCard } from './NoteCard';
import { NoteCardSkeleton } from './NoteCardSkeleton';

const SKELETON_COUNT = 4;

interface NotesListProps {
  params: NotesListParams;
}

export function NotesList({ params }: NotesListProps) {
  const { data, isLoading, isError, refetch } = useNotesQuery(params);
  const restoreNote = useRestoreNoteMutation();
  const listRef = useRef<HTMLUListElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const cards = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-note-card]') ?? []);
    const currentIndex = cards.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) {
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
    cards[Math.max(0, Math.min(cards.length - 1, nextIndex))]?.focus();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading notes">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <NoteCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 p-8 text-center"
      >
        <p className="text-sm text-destructive">Unable to load notes.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const notes = data?.data ?? [];

  if (notes.length === 0) {
    if (params.trash) {
      return <EmptyNotesState variant="empty-trash" />;
    }
    if (params.tagIds.length > 0) {
      return <EmptyNotesState variant="no-tag-match" />;
    }
    return <EmptyNotesState variant="no-notes" />;
  }

  return (
    <ul ref={listRef} onKeyDown={handleKeyDown} className="flex flex-col gap-3" aria-label="Notes">
      {notes.map((note) => (
        <li key={note.id}>
          <NoteCard
            note={note}
            isTrashView={params.trash}
            onRestore={(id) => restoreNote.mutate(id)}
            isRestoring={restoreNote.isPending && restoreNote.variables === note.id}
          />
        </li>
      ))}
    </ul>
  );
}
