import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';

/** UX §7.5: a 404 on `GET /api/notes/:id` is never retryable, so this is distinct from a retry banner. */
export function NoteNotFoundState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold text-foreground">Note not found</p>
      <p className="text-sm text-muted-foreground">
        This note doesn&apos;t exist, was deleted, or isn&apos;t yours.
      </p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );
}
