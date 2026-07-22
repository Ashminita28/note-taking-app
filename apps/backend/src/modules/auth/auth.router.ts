import { Router } from 'express';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
  ForgotPasswordRequestSchema,
  VerifyOtpRequestSchema,
  ResetPasswordRequestSchema,
} from '@note-app/shared';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  verifyOtpHandler,
  resetPasswordHandler,
} from './auth.controller.js';
import { otpRequestRateLimiter, otpVerifyRateLimiter } from './auth.rate-limiters.js';

const router = Router();

router.post('/register', validateBody(RegisterRequestSchema), register);
router.post('/login', validateBody(LoginRequestSchema), login);
router.post('/refresh', validateBody(RefreshRequestSchema), refresh);
router.post('/logout', requireAuth, validateBody(LogoutRequestSchema), logout);
router.get('/me', requireAuth, getMe);

router.post(
  '/forgot-password',
  validateBody(ForgotPasswordRequestSchema),
  otpRequestRateLimiter,
  forgotPassword,
);
router.post(
  '/verify-otp',
  validateBody(VerifyOtpRequestSchema),
  otpVerifyRateLimiter,
  verifyOtpHandler,
);
router.post('/reset-password', validateBody(ResetPasswordRequestSchema), resetPasswordHandler);

export { router as authRouter };
