import { z } from 'zod';
import { NoteResponseSchema } from './note.schemas.js';

/** Canonical source: FRS FR-VER-002–004, SDS Section 17.6 (version history endpoints). */

export const VersionNumberParamSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().min(1),
});

export const VersionListItemSchema = z.object({
  versionNumber: z.number().int(),
  title: z.string(),
  contentPreview: z.string(),
  createdAt: z.string().datetime(),
});

export const ListVersionsResponseSchema = z.object({
  versions: z.array(VersionListItemSchema),
});

export const VersionDetailSchema = z.object({
  versionNumber: z.number().int(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const GetVersionResponseSchema = z.object({
  version: VersionDetailSchema,
});

export const RestoreVersionResponseSchema = z.object({
  note: NoteResponseSchema,
});
