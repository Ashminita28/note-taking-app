import { Router } from 'express';
import { SearchQuerySchema } from '@note-app/shared';
import { validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { searchNotesHandler } from './search.controller.js';

const router = Router();

router.get('/', requireAuth, validateQuery(SearchQuerySchema), searchNotesHandler);

export { router as searchRouter };
