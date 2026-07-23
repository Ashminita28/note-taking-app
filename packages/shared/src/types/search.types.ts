import type { z } from 'zod';
import type {
  SearchQuerySchema,
  SearchResultSchema,
  SearchResponseSchema,
} from '../schemas/search.schemas.js';

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
