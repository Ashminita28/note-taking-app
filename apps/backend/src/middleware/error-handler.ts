import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../errors/app-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: ERROR_CODES.CONTENT_TOO_LARGE,
        message: 'Note content exceeds the maximum allowed size.',
        details: [],
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again.',
      details: [],
    },
  });
}
