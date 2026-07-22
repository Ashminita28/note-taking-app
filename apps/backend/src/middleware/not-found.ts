import type { Request, Response } from 'express';
import { ERROR_CODES } from '@note-app/shared';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      message: 'The requested resource was not found.',
      details: [],
    },
  });
}
