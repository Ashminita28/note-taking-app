import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.router.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet({ frameguard: { action: 'deny' } }));
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '500kb' }));
  app.use(requestLogger);
  app.use(rateLimiter);

  app.use('/api/auth', authRouter);

  // Further feature routes are mounted here by their owning tickets (AB-1004 onward).

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
