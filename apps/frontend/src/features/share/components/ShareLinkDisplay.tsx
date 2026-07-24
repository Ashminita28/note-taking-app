import { useEffect, useRef, useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/use-toast';
import { ViewCounterBadge } from './ViewCounterBadge';
import { formatUpdatedAt } from '../../notes/notes.utils';
import { COPIED_FEEDBACK_MS } from '../share.constants';

/** Common shape between a freshly-created `ShareLink` and a listed `ShareListItem` — this component only needs these three fields, not `token`/`noteId`/`noteTitle`. */
interface ShareLinkView {
  url: string;
  viewCount: number;
  expiresAt: string;
}

interface ShareLinkDisplayProps {
  shareLink: ShareLinkView;
  onRevoke: () => void;
  revokePending: boolean;
}

/** UX §8.11: link display, Copy Link (with "Copied! ✓" feedback), and Revoke Link (with inline confirm). */
export function ShareLinkDisplay({ shareLink, onRevoke, revokePending }: ShareLinkDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(shareLink.url);
      setCopied(true);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast({ description: 'Failed to copy link. Please copy manually.', variant: 'destructive' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input readOnly value={shareLink.url} aria-label="Share link" onFocus={(event) => event.target.select()} />
        <Button variant="outline" onClick={handleCopy}>
          {copied ? 'Copied! ✓' : 'Copy Link'}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <ViewCounterBadge viewCount={shareLink.viewCount} />
        <span>Expires {formatUpdatedAt(shareLink.expiresAt)}</span>
      </div>
      {confirmingRevoke ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/50 p-3">
          <span className="text-sm">Are you sure?</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmingRevoke(false)}>
              Cancel
            </Button>
            <Button variant="default" size="sm" isLoading={revokePending} onClick={onRevoke}>
              Yes, revoke
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirmingRevoke(true)}>
          Revoke Link
        </Button>
      )}
    </div>
  );
}
