import { Router } from 'express';
import {
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  NoteIdParamSchema,
  ListNotesQuerySchema,
} from '@note-app/shared';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listNotesHandler,
  createNoteHandler,
  getNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
  restoreNoteHandler,
} from './notes.controller.js';

const router = Router();

router.get('/', requireAuth, validateQuery(ListNotesQuerySchema), listNotesHandler);
router.post('/', requireAuth, validateBody(CreateNoteRequestSchema), createNoteHandler);
router.get('/:id', requireAuth, validateParams(NoteIdParamSchema), getNoteHandler);
router.patch(
  '/:id',
  requireAuth,
  validateParams(NoteIdParamSchema),
  validateBody(UpdateNoteRequestSchema),
  updateNoteHandler,
);
router.delete('/:id', requireAuth, validateParams(NoteIdParamSchema), deleteNoteHandler);
router.post('/:id/restore', requireAuth, validateParams(NoteIdParamSchema), restoreNoteHandler);

export { router as notesRouter };
