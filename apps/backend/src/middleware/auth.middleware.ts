import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../modules/auth/auth.tokens.js';
import {
  AccessTokenMissingError,
  AccessTokenExpiredError,
  AccessTokenInvalidError,
} from '../modules/auth/auth.errors.js';

const BEARER_PREFIX = 'Bearer ';

/** Verifies the JWT access token in the `Authorization` header and attaches `req.userId` (AZ-01, AZ-05). */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new AccessTokenMissingError());
    return;
  }

  const token = header.slice(BEARER_PREFIX.length);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AccessTokenExpiredError());
      return;
    }
    next(new AccessTokenInvalidError());
  }
}
