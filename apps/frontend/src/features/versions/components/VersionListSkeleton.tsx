import { Skeleton } from '../../../components/ui/skeleton';

export function VersionListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex flex-col gap-2 rounded-md border p-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
