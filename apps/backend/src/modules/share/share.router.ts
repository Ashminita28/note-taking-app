import { Router } from 'express';
import { NoteIdParamSchema, CreateShareRequestSchema, ShareTokenParamSchema } from '@note-app/shared';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  generateShareLinkHandler,
  revokeShareLinkHandler,
  listSharesHandler,
  getSharedNoteHandler,
} from './share.controller.js';

const router = Router();

// Full sub-paths (not a single resource prefix) — this module spans /api/notes/:id/share,
// /api/shares, and /api/shared/:token, so it mounts at the bare /api prefix in app.ts.
router.post(
  '/notes/:id/share',
  requireAuth,
  validateParams(NoteIdParamSchema),
  validateBody(CreateShareRequestSchema),
  generateShareLinkHandler,
);
router.delete(
  '/notes/:id/share',
  requireAuth,
  validateParams(NoteIdParamSchema),
  revokeShareLinkHandler,
);
router.get('/shares', requireAuth, listSharesHandler);
router.get('/shared/:token', validateParams(ShareTokenParamSchema), getSharedNoteHandler);

export { router as shareRouter };
