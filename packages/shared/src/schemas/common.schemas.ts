import { z } from 'zod';

/** Canonical source: SDS Section 18.2 (Successful List Response). Shared across every paginated endpoint. */
export const PaginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});
