import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError, type ErrorDetail } from '../errors/app-error.js';

/** Parses `req.body` against `schema`; on failure forwards a `ValidationError` (422) to the error handler. */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError(details));
      return;
    }

    req.body = result.data;
    next();
  };
}
