import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@note-app/shared';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again.',
      details: [],
    },
  });
}
