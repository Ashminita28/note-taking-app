import { formatUpdatedAt } from '../../notes/notes.utils';

interface VersionPreviewBannerProps {
  versionNumber: number;
  createdAt: string;
}

/** UX §8.12 Success States — yellow banner shown while previewing a past version. */
export function VersionPreviewBanner({ versionNumber, createdAt }: VersionPreviewBannerProps) {
  return (
    <div className="rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
      Viewing version {versionNumber} from {formatUpdatedAt(createdAt)}
    </div>
  );
}
