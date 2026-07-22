import { Router } from 'express';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
} from '@note-app/shared';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { register, login, refresh, logout, getMe } from './auth.controller.js';

const router = Router();

router.post('/register', validateBody(RegisterRequestSchema), register);
router.post('/login', validateBody(LoginRequestSchema), login);
router.post('/refresh', validateBody(RefreshRequestSchema), refresh);
router.post('/logout', requireAuth, validateBody(LogoutRequestSchema), logout);
router.get('/me', requireAuth, getMe);

export { router as authRouter };
