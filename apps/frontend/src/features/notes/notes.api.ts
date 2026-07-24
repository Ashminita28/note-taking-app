import type {
  ListNotesResponse,
  RestoreNoteResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteResponse,
  DeleteNoteResponse,
} from '@note-app/shared';
import { apiClient } from '../../lib/api-client';
import { buildNotesQuery } from './notes.utils';
import type { NotesListParams } from './notes.types';

export function getNotes(params: NotesListParams): Promise<ListNotesResponse> {
  return apiClient.request({ path: `/notes?${buildNotesQuery(params)}` });
}

export function restoreNote(id: string): Promise<RestoreNoteResponse> {
  return apiClient.request({ path: `/notes/${id}/restore`, method: 'POST' });
}

export function getNote(id: string): Promise<{ note: NoteResponse }> {
  return apiClient.request({ path: `/notes/${id}` });
}

export function createNote(input: CreateNoteRequest): Promise<{ note: NoteResponse }> {
  return apiClient.request({ path: '/notes', method: 'POST', body: input });
}

export function updateNote(id: string, input: UpdateNoteRequest): Promise<{ note: NoteResponse }> {
  return apiClient.request({ path: `/notes/${id}`, method: 'PATCH', body: input });
}

export function deleteNote(id: string): Promise<DeleteNoteResponse> {
  return apiClient.request({ path: `/notes/${id}`, method: 'DELETE' });
}
