import type { ListNotesResponse, RestoreNoteResponse } from '@note-app/shared';
import { apiClient } from '../../lib/api-client';
import { buildNotesQuery } from './notes.utils';
import type { NotesListParams } from './notes.types';

export function getNotes(params: NotesListParams): Promise<ListNotesResponse> {
  return apiClient.request({ path: `/notes?${buildNotesQuery(params)}` });
}

export function restoreNote(id: string): Promise<RestoreNoteResponse> {
  return apiClient.request({ path: `/notes/${id}/restore`, method: 'POST' });
}
