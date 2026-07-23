import type { TagWithCount } from '@note-app/shared';
import { cn } from '../../../lib/utils';

interface TagChipProps {
  tag: TagWithCount;
  selected: boolean;
  disabled?: boolean;
  onToggle: (tagId: string) => void;
}

export function TagChip({ tag, selected, disabled = false, onToggle }: TagChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onToggle(tag.id)}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-left text-sm transition-colors',
        selected ? 'border-primary bg-primary/10 text-primary' : 'border-transparent hover:bg-accent',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden="true" />
        {tag.name}
      </span>
      <span className="text-xs text-muted-foreground">{tag.noteCount}</span>
    </button>
  );
}
