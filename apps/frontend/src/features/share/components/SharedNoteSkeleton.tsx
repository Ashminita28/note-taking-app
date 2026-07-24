import { Loader2 } from 'lucide-react';

/** UX §8.13 Loading States: full-page centered spinner. */
export function SharedNoteSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
