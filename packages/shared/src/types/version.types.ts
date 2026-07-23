import type { z } from 'zod';
import type {
  VersionNumberParamSchema,
  VersionListItemSchema,
  ListVersionsResponseSchema,
  VersionDetailSchema,
  GetVersionResponseSchema,
  RestoreVersionResponseSchema,
} from '../schemas/version.schemas.js';

export type VersionNumberParam = z.infer<typeof VersionNumberParamSchema>;
export type VersionListItem = z.infer<typeof VersionListItemSchema>;
export type ListVersionsResponse = z.infer<typeof ListVersionsResponseSchema>;
export type VersionDetail = z.infer<typeof VersionDetailSchema>;
export type GetVersionResponse = z.infer<typeof GetVersionResponseSchema>;
export type RestoreVersionResponse = z.infer<typeof RestoreVersionResponseSchema>;
