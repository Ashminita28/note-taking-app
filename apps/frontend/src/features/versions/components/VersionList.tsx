import type { VersionListItem } from '@note-app/shared';
import { VersionItem } from './VersionItem';
import { VersionListSkeleton } from './VersionListSkeleton';

interface VersionListProps {
  versions: VersionListItem[] | undefined;
  isLoading: boolean;
  onSelect: (versionNumber: number) => void;
}

/** FR-VER-002: versions arrive newest-first from the API — rendered in that order as-is. */
export function VersionList({ versions, isLoading, onSelect }: VersionListProps) {
  if (isLoading) {
    return <VersionListSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3">
      {versions?.map((version) => (
        <VersionItem key={version.versionNumber} version={version} onSelect={onSelect} />
      ))}
    </div>
  );
}
