import type { RefObject } from 'react';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DEFAULT_SHARE_EXPIRY_HOURS } from '@note-app/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { ExpiryDropdown } from './ExpiryDropdown';
import { ShareLinkDisplay } from './ShareLinkDisplay';
import { useSharesQuery, useCreateShareMutation, useRevokeShareMutation } from '../share.hooks';
import { findShareForNote } from '../share.utils';

interface ShareModalProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus to on close (SDS §15.4 Rule 2) — the "More actions" trigger button. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** UX §8.11 / §7.8: generate, display/copy, and revoke a note's public share link. */
export function ShareModal({ noteId, open, onOpenChange, returnFocusRef }: ShareModalProps) {
  const [expiryHours, setExpiryHours] = useState(DEFAULT_SHARE_EXPIRY_HOURS);
  const sharesQuery = useSharesQuery({ enabled: open });
  const createMutation = useCreateShareMutation(noteId);
  const revokeMutation = useRevokeShareMutation(noteId);

  const activeShare = sharesQuery.data ? findShareForNote(sharesQuery.data.shares, noteId) : undefined;
  const displayedShare = createMutation.data?.shareLink ?? activeShare;

  function handleGenerate(): void {
    const payload = expiryHours === DEFAULT_SHARE_EXPIRY_HOURS ? {} : { expiresInHours: expiryHours };
    createMutation.mutate(payload);
  }

  function handleRevoke(): void {
    // `createMutation.data` otherwise keeps the just-generated link displayed forever (TanStack Query
    // mutation results persist until reset), so a successful revoke must explicitly clear it —
    // without this, `displayedShare` would keep preferring the stale (now-revoked) link over the
    // refetched (now-empty) shares list.
    revokeMutation.mutate(undefined, { onSuccess: () => createMutation.reset() });
  }

  function renderBody() {
    if (sharesQuery.isLoading) {
      return (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      );
    }

    if (sharesQuery.isError) {
      return <p className="text-sm text-destructive">Failed to generate share link.</p>;
    }

    if (displayedShare) {
      return (
        <ShareLinkDisplay
          shareLink={displayedShare}
          onRevoke={handleRevoke}
          revokePending={revokeMutation.isPending}
        />
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">No active share link for this note.</p>
        <ExpiryDropdown value={expiryHours} onChange={setExpiryHours} disabled={createMutation.isPending} />
        <Button onClick={handleGenerate} isLoading={createMutation.isPending}>
          Generate Link
        </Button>
        {createMutation.isError && <p className="text-sm text-destructive">Failed to generate share link.</p>}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Share note</DialogTitle>
          <DialogDescription>Anyone with the link can view a read-only copy of this note.</DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}
