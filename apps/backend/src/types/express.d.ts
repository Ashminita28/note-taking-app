import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the `requireAuth` middleware after verifying the JWT access token. */
    userId?: string;
  }
}
