import { useQuery } from '@tanstack/react-query';
import type { ListTagsResponse } from '@note-app/shared';
import { getTags } from './tags.api';

export function useTagsQuery() {
  return useQuery<ListTagsResponse>({
    queryKey: ['tags', 'list'],
    queryFn: getTags,
  });
}
