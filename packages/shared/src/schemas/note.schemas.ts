import { z } from 'zod';
import { NOTE_TITLE_MAX_LENGTH } from '../constants/limits.js';
import { DEFAULT_NOTE_TITLE } from '../constants/defaults.js';

/** Canonical source: FRS Section 13.2 (Notes validation rules), SDS Section 18.1 (response shape). */

/** Embedded tag shape for a note response — distinct from AB-1006's future full `Tag` entity schema. */
export const NoteTagRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
});

const trimmedTitle = z
  .string()
  .trim()
  .max(NOTE_TITLE_MAX_LENGTH, `Title must be at most ${NOTE_TITLE_MAX_LENGTH} characters.`);

/** Missing or blank title (after trim) defaults to "Untitled" (FRS §13.2). */
const createTitleSchema = trimmedTitle
  .optional()
  .transform((value) => (value === undefined || value === '' ? DEFAULT_NOTE_TITLE : value));

/** Omitted title on update means "leave unchanged"; an explicitly blank title still defaults. */
const updateTitleSchema = trimmedTitle
  .optional()
  .transform((value) => (value === undefined ? undefined : value === '' ? DEFAULT_NOTE_TITLE : value));

export const CreateNoteRequestSchema = z.object({
  title: createTitleSchema,
  content: z.string().optional().default(''),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const UpdateNoteRequestSchema = z.object({
  title: updateTitleSchema,
  content: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const NoteResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(NoteTagRefSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DeleteNoteResponseSchema = z.object({
  message: z.string(),
});

export const RestoreNoteResponseSchema = z.object({
  note: NoteResponseSchema,
});

export const NoteIdParamSchema = z.object({
  id: z.string().uuid(),
});
