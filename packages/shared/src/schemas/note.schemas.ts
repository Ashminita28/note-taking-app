import { z } from 'zod';
import { NOTE_TITLE_MAX_LENGTH, PAGE_MIN, PAGE_SIZE_MIN, PAGE_SIZE_MAX } from '../constants/limits.js';
import {
  DEFAULT_NOTE_TITLE,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
} from '../constants/defaults.js';
import { PaginationMetaSchema } from './common.schemas.js';

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

/** Canonical source: FRS Section 13.6 (Pagination), FR-NOTE-006 (sortBy/sortOrder/tagIds/includeTrashed). */

export const NOTE_SORT_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

/** `?tagIds=t1,t2` — a single comma-separated param, not repeated query keys. */
const commaSeparatedUuidList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()));

export const ListNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(PAGE_MIN).optional().default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(PAGE_SIZE_MIN)
    .max(PAGE_SIZE_MAX)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
  sortBy: z.enum(NOTE_SORT_FIELDS).optional().default(DEFAULT_SORT_BY),
  sortOrder: z.enum(SORT_ORDERS).optional().default(DEFAULT_SORT_ORDER),
  tagIds: commaSeparatedUuidList.optional(),
  includeTrashed: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
});

export const ListNotesResponseSchema = z.object({
  data: z.array(NoteResponseSchema),
  pagination: PaginationMetaSchema,
});
