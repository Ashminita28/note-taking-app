import { z } from 'zod';
import { SHARE_EXPIRY_MIN_HOURS, SHARE_EXPIRY_MAX_HOURS } from '../constants/limits.js';

/** Canonical source: FRS FR-SHARE-001–004, SDS Section 17.5/25 (sharing architecture). */

/**
 * No `.default()` here — the actual default (`SHARE_DEFAULT_EXPIRY_HRS`) is applied server-side
 * from env config, not baked into the shared schema, so an omitted field stays `undefined` through
 * validation and is resolved in the service.
 */
export const CreateShareRequestSchema = z.object({
  expiresInHours: z.coerce
    .number()
    .int()
    .min(SHARE_EXPIRY_MIN_HOURS, `Expiry must be at least ${SHARE_EXPIRY_MIN_HOURS} hour.`)
    .max(SHARE_EXPIRY_MAX_HOURS, `Expiry must be at most ${SHARE_EXPIRY_MAX_HOURS} hours.`)
    .optional(),
});

export const ShareLinkSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
  viewCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const CreateShareResponseSchema = z.object({
  shareLink: ShareLinkSchema,
});

export const RevokeShareResponseSchema = z.object({
  message: z.string(),
});

export const ShareListItemSchema = z.object({
  noteId: z.string().uuid(),
  noteTitle: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
  viewCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const ListSharesResponseSchema = z.object({
  shares: z.array(ShareListItemSchema),
});

export const SharedNoteViewSchema = z.object({
  title: z.string(),
  content: z.string(),
  authorName: z.string(),
  createdAt: z.string().datetime(),
});

export const GetSharedNoteResponseSchema = z.object({
  note: SharedNoteViewSchema,
});

/** Public token param — no `.uuid()` format check; an unrecognized token of any shape is a 404, not a 422. */
export const ShareTokenParamSchema = z.object({
  token: z.string().min(1),
});
