import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListVersionsResponse, GetVersionResponse, RestoreVersionResponse } from '@note-app/shared';
import { getVersions, getVersion, restoreVersion } from './versions.api';
import { toast } from '../../components/ui/use-toast';

export function useVersionsQuery(noteId: string, options?: { enabled?: boolean }) {
  return useQuery<ListVersionsResponse>({
    queryKey: ['versions', 'list', noteId],
    queryFn: () => getVersions(noteId),
    ...options,
  });
}

export function useVersionQuery(noteId: string, versionNumber: number | undefined) {
  return useQuery<GetVersionResponse>({
    queryKey: ['versions', 'detail', noteId, versionNumber],
    queryFn: () => getVersion(noteId, versionNumber as number),
    enabled: versionNumber !== undefined,
  });
}

/** BR-009: restoring creates a new version — the list must be refetched, not patched locally. */
export function useRestoreVersionMutation(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation<RestoreVersionResponse, unknown, number>({
    mutationFn: (versionNumber) => restoreVersion(noteId, versionNumber),
    onSuccess: (result) => {
      queryClient.setQueryData(['notes', 'detail', noteId], { note: result.note });
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['versions', 'list', noteId] });
    },
    onError: () => {
      toast({ description: 'Failed to restore version. Please try again.', variant: 'destructive' });
    },
  });
}
