import { Link } from 'react-router-dom';
import type { NoteResponse } from '@note-app/shared';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { NOTE_PREVIEW_LENGTH } from '../notes.constants';
import { formatUpdatedAt, stripHtmlToPlainText, truncate } from '../notes.utils';

interface NoteCardProps {
  note: NoteResponse;
  isTrashView?: boolean;
  onRestore?: (id: string) => void;
  isRestoring?: boolean;
}

export function NoteCard({ note, isTrashView = false, onRestore, isRestoring = false }: NoteCardProps) {
  const preview = truncate(stripHtmlToPlainText(note.content), NOTE_PREVIEW_LENGTH);

  const body = (
    <>
      <p className="truncate text-base font-semibold text-foreground">{note.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preview || 'No content yet'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {note.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            {tag.name}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{formatUpdatedAt(note.updatedAt)}</span>
      </div>
    </>
  );

  if (isTrashView) {
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
        {body}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          isLoading={isRestoring}
          onClick={() => onRestore?.(note.id)}
        >
          Restore
        </Button>
      </div>
    );
  }

  return (
    <Link
      to={`/notes/${note.id}`}
      data-note-card
      className="block rounded-md border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}
