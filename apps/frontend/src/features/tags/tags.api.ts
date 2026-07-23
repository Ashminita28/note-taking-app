import type { ListTagsResponse } from '@note-app/shared';
import { apiClient } from '../../lib/api-client';

export function getTags(): Promise<ListTagsResponse> {
  return apiClient.request({ path: '/tags' });
}
