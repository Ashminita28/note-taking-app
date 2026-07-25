import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type { NoteResponse } from '@note-app/shared';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/use-toast';
import { VersionList } from './VersionList';
import { VersionPreviewBanner } from './VersionPreviewBanner';
import { VersionContent } from './VersionContent';
import { useVersionsQuery, useVersionQuery, useRestoreVersionMutation } from '../versions.hooks';

interface VersionHistoryDrawerProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus to on close (SDS §15.4 Rule 2) — the "More actions" trigger button. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Fired with the restored note so the caller can sync the live editor (plan.md Decision 1). */
  onRestored: (note: NoteResponse) => void;
}

/** UX §8.12 / §7.9: browse a note's version history, preview a version, and restore it. */
export function VersionHistoryDrawer({
  noteId,
  open,
  onOpenChange,
  returnFocusRef,
  onRestored,
}: VersionHistoryDrawerProps) {
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | undefined>(undefined);

  const versionsQuery = useVersionsQuery(noteId, { enabled: open });
  const versionQuery = useVersionQuery(noteId, selectedVersionNumber);
  const restoreMutation = useRestoreVersionMutation(noteId);

  useEffect(() => {
    if (versionsQuery.isError) {
      toast({ description: 'Unable to load version history.', variant: 'destructive' });
    }
  }, [versionsQuery.isError]);

  useEffect(() => {
    if (versionQuery.isError) {
      toast({ description: 'Unable to load that version.', variant: 'destructive' });
      setSelectedVersionNumber(undefined);
    }
  }, [versionQuery.isError]);

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      setSelectedVersionNumber(undefined);
    }
    onOpenChange(nextOpen);
  }

  function handleRestore(): void {
    if (selectedVersionNumber === undefined) {
      return;
    }
    const versionNumber = selectedVersionNumber;
    restoreMutation.mutate(versionNumber, {
      onSuccess: (result) => {
        onRestored(result.note);
        toast({ description: `Version ${versionNumber} restored.` });
        handleOpenChange(false);
      },
    });
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        aria-label="Version history"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
      >
        <DrawerTitle>Version history</DrawerTitle>
        <DrawerDescription className="sr-only">
          View and restore previous versions of this note.
        </DrawerDescription>
        <div className="flex-1 overflow-y-auto">
          {selectedVersionNumber === undefined && (
            <VersionList
              versions={versionsQuery.data?.versions}
              isLoading={versionsQuery.isLoading}
              onSelect={setSelectedVersionNumber}
            />
          )}
          {selectedVersionNumber !== undefined && versionQuery.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          {selectedVersionNumber !== undefined && versionQuery.data && (
            <div className="flex flex-col gap-4">
              <VersionPreviewBanner
                versionNumber={versionQuery.data.version.versionNumber}
                createdAt={versionQuery.data.version.createdAt}
              />
              <VersionContent content={versionQuery.data.version.content} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedVersionNumber(undefined)}>
                  Back to current
                </Button>
                <Button onClick={handleRestore} isLoading={restoreMutation.isPending}>
                  Restore this version
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
