import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ListNotesResponse,
  RestoreNoteResponse,
  NoteResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
  DeleteNoteResponse,
} from '@note-app/shared';
import { getNotes, restoreNote, getNote, createNote, updateNote, deleteNote } from './notes.api';
import type { NotesListParams } from './notes.types';
import { toast } from '../../components/ui/use-toast';
import { ApiError } from '../../lib/api-client';

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

export function useNoteQuery(id: string, options: { enabled: boolean }) {
  return useQuery<{ note: NoteResponse }>({
    queryKey: ['notes', 'detail', id],
    queryFn: () => getNote(id),
    enabled: options.enabled,
    // A 404 (BR-002: not found / not owned) is deterministic — retrying it only delays the
    // "Note not found" state (spec.md Scenario 3). Other failures still get the default retries.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/** First autosave on a new note (plan.md Decision 1) — primes the detail cache so the post-create URL swap never refetches. */
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ note: NoteResponse }, unknown, CreateNoteRequest>({
    mutationFn: (input) => createNote(input),
    onSuccess: (result) => {
      queryClient.setQueryData(['notes', 'detail', result.note.id], result);
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tags', 'list'] });
    },
  });
}

export function useUpdateNoteMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation<{ note: NoteResponse }, unknown, UpdateNoteRequest>({
    mutationFn: (input) => updateNote(id, input),
    onSuccess: (result) => {
      queryClient.setQueryData(['notes', 'detail', id], result);
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tags', 'list'] });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation<DeleteNoteResponse, unknown, string>({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tags', 'list'] });
    },
  });
}
