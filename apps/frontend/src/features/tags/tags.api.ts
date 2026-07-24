import type { ListTagsResponse, CreateTagRequest, TagResponse } from '@note-app/shared';
import { apiClient } from '../../lib/api-client';

export function getTags(): Promise<ListTagsResponse> {
  return apiClient.request({ path: '/tags' });
}

export function createTag(input: CreateTagRequest): Promise<{ tag: TagResponse }> {
  return apiClient.request({ path: '/tags', method: 'POST', body: input });
}
