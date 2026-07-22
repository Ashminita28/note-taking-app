import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  RESET_TOKEN_EXPIRY_MIN: z.coerce.number().int().positive().default(15),
  SHARE_DEFAULT_EXPIRY_HRS: z.coerce.number().int().positive().default(168),
  VERSION_PURGE_DAYS: z.coerce.number().int().positive().default(90),
  VERSION_MIN_RETAIN: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See errors above.');
}

export const config = parsed.data;
export type Config = typeof config;
