import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ListSharesResponse,
  CreateShareRequest,
  CreateShareResponse,
  RevokeShareResponse,
  GetSharedNoteResponse,
} from '@note-app/shared';
import { getShares, createShare, revokeShare, getSharedNote } from './share.api';
import { toast } from '../../components/ui/use-toast';
import { ApiError } from '../../lib/api-client';

export function useSharesQuery(options?: { enabled?: boolean }) {
  return useQuery<ListSharesResponse>({
    queryKey: ['shares', 'list'],
    queryFn: getShares,
    ...options,
  });
}

export function useCreateShareMutation(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation<CreateShareResponse, unknown, CreateShareRequest>({
    mutationFn: (input) => createShare(noteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'detail', noteId] });
      queryClient.invalidateQueries({ queryKey: ['shares', 'list'] });
    },
    onError: () => {
      toast({ description: 'Failed to generate share link.', variant: 'destructive' });
    },
  });
}

export function useRevokeShareMutation(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation<RevokeShareResponse, unknown, void>({
    mutationFn: () => revokeShare(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'detail', noteId] });
      queryClient.invalidateQueries({ queryKey: ['shares', 'list'] });
    },
    onError: () => {
      toast({ description: 'Failed to revoke share link. Please try again.', variant: 'destructive' });
    },
  });
}

/** A 404/410 on a share token is deterministic (not-found / expired) — retrying only delays the correct error state. */
export function useSharedNoteQuery(token: string) {
  return useQuery<GetSharedNoteResponse>({
    queryKey: ['shared', token],
    queryFn: () => getSharedNote(token),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
