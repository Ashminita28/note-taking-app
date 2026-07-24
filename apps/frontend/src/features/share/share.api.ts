import type {
  ListSharesResponse,
  CreateShareRequest,
  CreateShareResponse,
  RevokeShareResponse,
  GetSharedNoteResponse,
} from '@note-app/shared';
import { apiClient } from '../../lib/api-client';

export function getShares(): Promise<ListSharesResponse> {
  return apiClient.request({ path: '/shares' });
}

export function createShare(noteId: string, input: CreateShareRequest): Promise<CreateShareResponse> {
  return apiClient.request({ path: `/notes/${noteId}/share`, method: 'POST', body: input });
}

export function revokeShare(noteId: string): Promise<RevokeShareResponse> {
  return apiClient.request({ path: `/notes/${noteId}/share`, method: 'DELETE' });
}

export function getSharedNote(token: string): Promise<GetSharedNoteResponse> {
  return apiClient.request({ path: `/shared/${token}` });
}
