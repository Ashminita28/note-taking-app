import { Button } from '../../../components/ui/button';

interface TrashToggleProps {
  trash: boolean;
  onChange: (trash: boolean) => void;
}

export function TrashToggle({ trash, onChange }: TrashToggleProps) {
  return (
    <Button variant={trash ? 'default' : 'outline'} size="sm" aria-pressed={trash} onClick={() => onChange(!trash)}>
      {trash ? 'Back to notes' : 'Trash'}
    </Button>
  );
}
