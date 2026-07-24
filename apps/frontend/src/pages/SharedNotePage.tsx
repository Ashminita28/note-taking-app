import { Link, useParams } from 'react-router-dom';
import { useSharedNoteQuery } from '../features/share/share.hooks';
import { SharedNoteContent } from '../features/share/components/SharedNoteContent';
import { SharedNoteSkeleton } from '../features/share/components/SharedNoteSkeleton';
import { SharedNoteErrorState } from '../features/share/components/SharedNoteErrorState';
import { formatUpdatedAt } from '../features/notes/notes.utils';
import { ApiError } from '../lib/api-client';

/** UX-SCR-013: public read-only shared note view. No auth required, not wrapped in ProtectedRoute. */
export function SharedNotePage() {
  const { token } = useParams<{ token: string }>();
  const query = useSharedNoteQuery(token ?? '');

  if (query.isLoading) {
    return <SharedNoteSkeleton />;
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.status === 404) {
      return <SharedNoteErrorState variant="not-found" />;
    }
    if (error instanceof ApiError && error.status === 410) {
      return <SharedNoteErrorState variant="expired" />;
    }
    return <SharedNoteErrorState variant="error" />;
  }

  if (!query.data) {
    return <SharedNoteSkeleton />;
  }

  const { note } = query.data;

  return (
    <div className="flex min-h-screen justify-center p-6">
      <article className="w-full max-w-[800px]">
        <h1 className="mb-2 text-2xl font-semibold">{note.title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          by {note.authorName} &middot; {formatUpdatedAt(note.createdAt)}
        </p>
        <SharedNoteContent content={note.content} />
        <footer className="mt-10 border-t pt-6 text-center">
          <Link to="/register" className="text-sm text-primary underline-offset-4 hover:underline">
            Create your account
          </Link>
        </footer>
      </article>
    </div>
  );
}
