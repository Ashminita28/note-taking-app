import { z } from 'zod';
import { TAG_NAME_MIN_LENGTH, TAG_NAME_MAX_LENGTH } from '../constants/limits.js';
import { DEFAULT_TAG_COLOR } from '../constants/defaults.js';

/** Canonical source: FRS Section 13 (Tags validation rules), SDS Section 17.3 (endpoint contracts). */

const trimmedTagName = z
  .string()
  .trim()
  .min(TAG_NAME_MIN_LENGTH, 'Tag name is required.')
  .max(TAG_NAME_MAX_LENGTH, `Tag name must be at most ${TAG_NAME_MAX_LENGTH} characters.`);

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const hexColorSchema = z
  .string()
  .regex(HEX_COLOR_PATTERN, 'Color must be a 7-character hex code (e.g. #RRGGBB).');

export const CreateTagRequestSchema = z.object({
  name: trimmedTagName,
  color: hexColorSchema.optional().default(DEFAULT_TAG_COLOR),
});

export const UpdateTagRequestSchema = z.object({
  name: trimmedTagName.optional(),
  color: hexColorSchema.optional(),
});

export const TagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TagWithCountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  noteCount: z.number().int(),
});

export const ListTagsResponseSchema = z.object({
  tags: z.array(TagWithCountSchema),
});

export const DeleteTagResponseSchema = z.object({
  message: z.string(),
});

export const TagIdParamSchema = z.object({
  id: z.string().uuid(),
});
