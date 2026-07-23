import { Skeleton } from '../../../components/ui/skeleton';

export function TagListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading tags">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-6 w-full rounded-sm" />
      ))}
    </div>
  );
}
