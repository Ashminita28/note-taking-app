import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListNotesResponse, RestoreNoteResponse } from '@note-app/shared';
import { getNotes, restoreNote } from './notes.api';
import type { NotesListParams } from './notes.types';
import { toast } from '../../components/ui/use-toast';

export function useNotesQuery(params: NotesListParams) {
  return useQuery<ListNotesResponse>({
    queryKey: ['notes', 'list', params],
    queryFn: () => getNotes(params),
  });
}

/** Restoring a note can change tag note counts, so both list caches are invalidated (SDS §22.3). */
export function useRestoreNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation<RestoreNoteResponse, unknown, string>({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tags', 'list'] });
      toast({ description: 'Note restored' });
    },
  });
}
