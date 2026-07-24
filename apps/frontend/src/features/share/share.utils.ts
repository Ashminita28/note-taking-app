import type { ShareListItem } from '@note-app/shared';

export function findShareForNote(shares: ShareListItem[], noteId: string): ShareListItem | undefined {
  return shares.find((share) => share.noteId === noteId);
}
