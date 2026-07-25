import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@note-app/shared';
import { config } from '../config/env.js';

export function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests. Please try again later.',
      details: [],
    },
  });
}

/**
 * Outside production, a single Playwright E2E run's cumulative requests (register/login plus
 * dozens of note/tag/share/version calls across the full spec suite) legitimately exceeds a
 * 100/min budget from one IP with no real abuse involved — so only production enforces the
 * strict limit; dev/test get a budget high enough that no local or CI test run trips it.
 */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.NODE_ENV === 'production' ? 100 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
