import { Badge } from '../../../components/ui/badge';

interface ViewCounterBadgeProps {
  viewCount: number;
}

/** UX-SHARE-01: view count is shown for an active share link. */
export function ViewCounterBadge({ viewCount }: ViewCounterBadgeProps) {
  return <Badge variant="secondary">{viewCount} {viewCount === 1 ? 'view' : 'views'}</Badge>;
}
