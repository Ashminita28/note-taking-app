import type { z } from 'zod';
import type {
  NoteTagRefSchema,
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  NoteResponseSchema,
  DeleteNoteResponseSchema,
  RestoreNoteResponseSchema,
  NoteIdParamSchema,
} from '../schemas/note.schemas.js';

export type NoteTagRef = z.infer<typeof NoteTagRefSchema>;
export type CreateNoteRequest = z.infer<typeof CreateNoteRequestSchema>;
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;
export type NoteResponse = z.infer<typeof NoteResponseSchema>;
export type DeleteNoteResponse = z.infer<typeof DeleteNoteResponseSchema>;
export type RestoreNoteResponse = z.infer<typeof RestoreNoteResponseSchema>;
export type NoteIdParam = z.infer<typeof NoteIdParamSchema>;
