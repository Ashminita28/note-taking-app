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

/** Parses `req.params` against `schema`; on failure forwards a `ValidationError` (422) to the error handler. */
export function validateParams(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError(details));
      return;
    }

    req.params = result.data as typeof req.params;
    next();
  };
}

/**
 * Parses `req.query` against `schema`; on failure forwards a `ValidationError` (422) to the error
 * handler. Stashes the parsed/defaulted result on `req.validatedQuery` rather than reassigning
 * `req.query` — Express 5 defines `query` as a getter-only property, so writing back to it throws.
 */
export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError(details));
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
