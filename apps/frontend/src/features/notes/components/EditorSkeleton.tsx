import { Skeleton } from '../../../components/ui/skeleton';

/** UX §8.7 Loading States: skeleton title bar + skeleton editor body while `GET /api/notes/:id` resolves. */
export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6" data-testid="editor-skeleton">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
