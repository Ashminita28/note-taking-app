import { Router } from 'express';
import { NoteIdParamSchema, VersionNumberParamSchema } from '@note-app/shared';
import { validateParams } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listVersionsHandler,
  getVersionHandler,
  restoreVersionHandler,
} from './versions.controller.js';

const router = Router();

router.get('/:id/versions', requireAuth, validateParams(NoteIdParamSchema), listVersionsHandler);
router.get(
  '/:id/versions/:versionNumber',
  requireAuth,
  validateParams(VersionNumberParamSchema),
  getVersionHandler,
);
router.post(
  '/:id/versions/:versionNumber/restore',
  requireAuth,
  validateParams(VersionNumberParamSchema),
  restoreVersionHandler,
);

export { router as versionsRouter };
