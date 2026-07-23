import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';

export type EmptyNotesVariant = 'no-notes' | 'no-tag-match' | 'empty-trash';

const COPY: Record<EmptyNotesVariant, { icon: string; title: string; description: string }> = {
  'no-notes': {
    icon: '📝',
    title: 'No notes yet',
    description: 'Create your first note to get started',
  },
  'no-tag-match': {
    icon: '🏷️',
    title: 'No notes with this tag',
    description: 'Try selecting a different tag',
  },
  'empty-trash': {
    icon: '🗑️',
    title: 'Trash is empty',
    description: 'Deleted notes appear here for 30 days',
  },
};

export function EmptyNotesState({ variant }: { variant: EmptyNotesVariant }) {
  const navigate = useNavigate();
  const copy = COPY[variant];

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">
        {copy.icon}
      </span>
      <p className="text-lg font-semibold text-foreground">{copy.title}</p>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      {variant === 'no-notes' && (
        <Button className="mt-2" onClick={() => navigate('/notes/new')}>
          Create your first note
        </Button>
      )}
    </div>
  );
}
