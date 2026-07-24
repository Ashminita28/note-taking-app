import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { SaveStatus } from '../notes.types';

const LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving...',
  saved: 'Saved ✓',
  error: 'Save failed',
};

interface AutosaveStatusIndicatorProps {
  status: SaveStatus;
  /** Specific reason for a save failure (size limit, server message) — falls back to the generic label when absent. */
  message?: string;
}

/** UX-NOTE-02 / SDS §23.3 Rules 3–5: Saving.../Saved ✓/Save failed lifecycle, announced via aria-live. */
export function AutosaveStatusIndicator({ status, message }: AutosaveStatusIndicatorProps) {
  if (status === 'idle') {
    return <span aria-live="polite" className="text-sm" />;
  }

  const label = status === 'error' && message ? message : LABELS[status];

  return (
    <span
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-sm',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {label}
    </span>
  );
}
