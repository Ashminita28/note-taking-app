import type { z } from 'zod';
import type { PaginationMetaSchema } from '../schemas/common.schemas.js';

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
