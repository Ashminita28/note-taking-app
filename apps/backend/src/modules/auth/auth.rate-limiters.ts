import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@note-app/shared';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Per-email (not per-IP) keying — FRS §28.3 rate limits are scoped by the target email, so a single attacker can't exhaust one victim's quota from many IPs while leaving other victims unaffected. */
function emailKey(req: Request): string {
  return (req.body as { email?: string }).email ?? 'unknown';
}

export const otpRequestRateLimiter = rateLimit({
  windowMs: ONE_HOUR_MS,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  handler: (_req: Request, res: Response): void => {
    res.status(429).json({
      error: {
        code: ERROR_CODES.OTP_RATE_LIMIT,
        message: 'Too many requests. Try again later.',
        details: [],
      },
    });
  },
});

export const otpVerifyRateLimiter = rateLimit({
  windowMs: ONE_HOUR_MS,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  handler: (_req: Request, res: Response): void => {
    res.status(429).json({
      error: {
        code: ERROR_CODES.OTP_VERIFY_RATE_LIMIT,
        message: 'Too many attempts. Try again later.',
        details: [],
      },
    });
  },
});
