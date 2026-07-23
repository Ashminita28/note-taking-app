import type { z } from 'zod';
import type {
  CreateTagRequestSchema,
  UpdateTagRequestSchema,
  TagResponseSchema,
  TagWithCountSchema,
  ListTagsResponseSchema,
  DeleteTagResponseSchema,
  TagIdParamSchema,
} from '../schemas/tag.schemas.js';

export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;
export type UpdateTagRequest = z.infer<typeof UpdateTagRequestSchema>;
export type TagResponse = z.infer<typeof TagResponseSchema>;
export type TagWithCount = z.infer<typeof TagWithCountSchema>;
export type ListTagsResponse = z.infer<typeof ListTagsResponseSchema>;
export type DeleteTagResponse = z.infer<typeof DeleteTagResponseSchema>;
export type TagIdParam = z.infer<typeof TagIdParamSchema>;
