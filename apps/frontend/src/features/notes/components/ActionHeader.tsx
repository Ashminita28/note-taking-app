import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../components/ui/dropdown-menu';
import { AutosaveStatusIndicator } from './AutosaveStatusIndicator';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { NOTE_TITLE_MAX_LENGTH } from '@note-app/shared';
import type { SaveStatus } from '../notes.types';

interface ActionHeaderProps {
  noteId: string;
  title: string;
  onTitleChange: (title: string) => void;
  status: SaveStatus;
  /** Specific reason for a save failure (size limit, server message) — passed through to the indicator. */
  errorMessage?: string;
  /** A brand-new, not-yet-created note has nothing to delete yet. */
  canDelete: boolean;
  /** New notes (UX-NOTE-01) place initial focus in the title field. */
  autoFocusTitle?: boolean;
  /** Undefined until AB-1014 wires the Share modal — the menu item renders disabled until then. */
  onShare?: () => void;
  /** Undefined until AB-1015 wires the version history drawer — the menu item renders disabled until then. */
  onHistory?: () => void;
}

/** Back button, title input, autosave indicator, and "More" menu (Share/History/Move to trash — UX §8.7). */
export function ActionHeader({
  noteId,
  title,
  onTitleChange,
  status,
  errorMessage,
  canDelete,
  autoFocusTitle,
  onShare,
  onHistory,
}: ActionHeaderProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
      <Button variant="ghost" size="sm" aria-label="Back to Dashboard" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Input
        aria-label="Note title"
        placeholder="Untitled"
        maxLength={NOTE_TITLE_MAX_LENGTH}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        autoFocus={autoFocusTitle}
        className="lg:max-w-sm border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
      />
      <div className="flex-1" />
      <AutosaveStatusIndicator status={status} message={errorMessage} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={moreMenuTriggerRef} variant="ghost" size="sm" aria-label="More actions">
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!onShare} onSelect={() => onShare?.()}>
            Share
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!onHistory} onSelect={() => onHistory?.()}>
            History
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canDelete} onSelect={() => setDeleteDialogOpen(true)}>
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete && (
        <DeleteNoteDialog
          noteId={noteId}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          returnFocusRef={moreMenuTriggerRef}
        />
      )}
    </header>
  );
}
