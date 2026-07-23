import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the `requireAuth` middleware after verifying the JWT access token. */
    userId?: string;
    /**
     * Set by `validateQuery` — holds the parsed/defaulted query object. Express 5 makes `req.query`
     * a getter-only property (computed from `req.originalUrl`), so validated query data can't be
     * written back onto it the way `validateBody`/`validateParams` do for `req.body`/`req.params`.
     */
    validatedQuery?: unknown;
  }
}
