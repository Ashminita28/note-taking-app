import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** UX §11 Skeleton Pattern Rules: `--surface` background, 1.5s linear pulse, dimensions match real content. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-shimmer rounded-md bg-muted', className)} aria-hidden="true" {...props} />;
}
