import type { z } from 'zod';
import type {
  CreateShareRequestSchema,
  ShareLinkSchema,
  CreateShareResponseSchema,
  RevokeShareResponseSchema,
  ShareListItemSchema,
  ListSharesResponseSchema,
  SharedNoteViewSchema,
  GetSharedNoteResponseSchema,
  ShareTokenParamSchema,
} from '../schemas/share.schemas.js';

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
export type ShareLink = z.infer<typeof ShareLinkSchema>;
export type CreateShareResponse = z.infer<typeof CreateShareResponseSchema>;
export type RevokeShareResponse = z.infer<typeof RevokeShareResponseSchema>;
export type ShareListItem = z.infer<typeof ShareListItemSchema>;
export type ListSharesResponse = z.infer<typeof ListSharesResponseSchema>;
export type SharedNoteView = z.infer<typeof SharedNoteViewSchema>;
export type GetSharedNoteResponse = z.infer<typeof GetSharedNoteResponseSchema>;
export type ShareTokenParam = z.infer<typeof ShareTokenParamSchema>;
