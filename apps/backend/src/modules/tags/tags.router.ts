import { Router } from 'express';
import { CreateTagRequestSchema, UpdateTagRequestSchema, TagIdParamSchema } from '@note-app/shared';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listTagsHandler,
  createTagHandler,
  updateTagHandler,
  deleteTagHandler,
} from './tags.controller.js';

const router = Router();

router.get('/', requireAuth, listTagsHandler);
router.post('/', requireAuth, validateBody(CreateTagRequestSchema), createTagHandler);
router.patch(
  '/:id',
  requireAuth,
  validateParams(TagIdParamSchema),
  validateBody(UpdateTagRequestSchema),
  updateTagHandler,
);
router.delete('/:id', requireAuth, validateParams(TagIdParamSchema), deleteTagHandler);

export { router as tagsRouter };
