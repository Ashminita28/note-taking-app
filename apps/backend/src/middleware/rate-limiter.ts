import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@note-app/shared';

export function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests. Please try again later.',
      details: [],
    },
  });
}

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
