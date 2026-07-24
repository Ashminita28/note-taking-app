import { Skeleton } from '../../../components/ui/skeleton';

export function SearchResultSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
