import type { VersionListItem } from '@note-app/shared';
import { formatUpdatedAt } from '../../notes/notes.utils';

interface VersionItemProps {
  version: VersionListItem;
  onSelect: (versionNumber: number) => void;
}

/** One row in the version list (UX-VER-04). `contentPreview` is already server-truncated
 *  (`VERSION_PREVIEW_LENGTH`) — the `truncate` class here only clips the display, it doesn't
 *  re-truncate the data. */
export function VersionItem({ version, onSelect }: VersionItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(version.versionNumber)}
      className="flex w-full flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between gap-2 font-medium">
        <span>Version {version.versionNumber}</span>
        <span className="text-xs font-normal text-muted-foreground">{formatUpdatedAt(version.createdAt)}</span>
      </span>
      <span className="truncate text-muted-foreground">{version.contentPreview}</span>
    </button>
  );
}
