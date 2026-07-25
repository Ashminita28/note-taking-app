import type { ListVersionsResponse, GetVersionResponse, RestoreVersionResponse } from '@note-app/shared';
import { apiClient } from '../../lib/api-client';

export function getVersions(noteId: string): Promise<ListVersionsResponse> {
  return apiClient.request({ path: `/notes/${noteId}/versions` });
}

export function getVersion(noteId: string, versionNumber: number): Promise<GetVersionResponse> {
  return apiClient.request({ path: `/notes/${noteId}/versions/${versionNumber}` });
}

export function restoreVersion(noteId: string, versionNumber: number): Promise<RestoreVersionResponse> {
  return apiClient.request({ path: `/notes/${noteId}/versions/${versionNumber}/restore`, method: 'POST' });
}
