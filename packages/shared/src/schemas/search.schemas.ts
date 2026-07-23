import { z } from 'zod';
import {
  SEARCH_QUERY_MIN_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  PAGE_MIN,
  PAGE_SIZE_MIN,
  PAGE_SIZE_MAX,
} from '../constants/limits.js';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../constants/defaults.js';
import { PaginationMetaSchema } from './common.schemas.js';

/** Canonical source: FRS FR-SRCH-001 (validation rules), SDS Section 17.4/24.4 (search query/response). */

/** `?tagIds=t1,t2` — mirrors AB-1005's `commaSeparatedUuidList` decision exactly, for API consistency. */
const commaSeparatedUuidList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()));

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(SEARCH_QUERY_MIN_LENGTH, 'Search query is required.')
    .max(SEARCH_QUERY_MAX_LENGTH, `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters.`),
  page: z.coerce.number().int().min(PAGE_MIN).optional().default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(PAGE_SIZE_MIN)
    .max(PAGE_SIZE_MAX)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
  tagIds: commaSeparatedUuidList.optional(),
});

export const SearchResultSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  snippet: z.string(),
  rank: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SearchResponseSchema = z.object({
  data: z.array(SearchResultSchema),
  pagination: PaginationMetaSchema,
});
