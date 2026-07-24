import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';

type SharedNoteErrorVariant = 'not-found' | 'expired' | 'error';

interface SharedNoteErrorStateProps {
  variant: SharedNoteErrorVariant;
}

const COPY: Record<SharedNoteErrorVariant, { title: string; description: string }> = {
  'not-found': { title: 'Note not found', description: "This link doesn't exist or has been removed." },
  expired: { title: 'This link has expired', description: 'Ask the owner to share a new link.' },
  error: { title: 'Something went wrong', description: 'Please try again later.' },
};

/** UX §8.13 Error States: full-page 404/410 screens, plus a generic transient-failure state. */
export function SharedNoteErrorState({ variant }: SharedNoteErrorStateProps) {
  const navigate = useNavigate();
  const { title, description } = COPY[variant];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {variant !== 'error' && <Button onClick={() => navigate('/register')}>Create your account</Button>}
    </div>
  );
}
