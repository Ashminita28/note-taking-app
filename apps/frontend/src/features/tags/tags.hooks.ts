import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ERROR_CODES } from '@note-app/shared';
import type { ListTagsResponse, CreateTagRequest, NoteTagRef } from '@note-app/shared';
import { getTags, createTag } from './tags.api';
import { ApiError } from '../../lib/api-client';

export function useTagsQuery() {
  return useQuery<ListTagsResponse>({
    queryKey: ['tags', 'list'],
    queryFn: getTags,
  });
}

/**
 * Inline tag creation from the editor's tag bar (UX-TAG-03). On `409 TAG_NAME_EXISTS` the existing
 * tag is silently reused (plan.md Decision 4) rather than surfacing an error — from the user's
 * perspective, attaching a tag that already exists by name should just work.
 */
export function useCreateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation<NoteTagRef, unknown, CreateTagRequest>({
    mutationFn: async (input) => {
      try {
        const { tag } = await createTag(input);
        return { id: tag.id, name: tag.name, color: tag.color };
      } catch (error) {
        if (error instanceof ApiError && error.code === ERROR_CODES.TAG_NAME_EXISTS) {
          const cached = queryClient.getQueryData<ListTagsResponse>(['tags', 'list']);
          const existing = cached?.tags.find(
            (candidate) => candidate.name.toLowerCase() === input.name.trim().toLowerCase(),
          );
          if (existing) {
            return { id: existing.id, name: existing.name, color: existing.color };
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', 'list'] });
    },
  });
}
