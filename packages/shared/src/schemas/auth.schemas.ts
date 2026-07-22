import { z } from 'zod';
import {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../constants/limits.js';
import { isStrongPassword } from '../utils/validation.js';

/** Canonical source: FRS Section 13.1 (User Registration & Authentication validation rules). */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters.`)
  .email('Invalid email format.');

const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  .refine(
    isStrongPassword,
    'Password must contain an uppercase letter, a lowercase letter, a digit, and a special character (!@#$%^&*).',
  );

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

export const RegisterRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN_LENGTH, 'Name is required.')
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters.`),
  email: emailSchema,
  password: strongPasswordSchema,
});

export const RegisterResponseSchema = z.object({
  user: UserProfileSchema,
});

export const LoginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserProfileSchema,
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export const LogoutResponseSchema = z.object({
  message: z.string(),
});

export const MeResponseSchema = z.object({
  user: UserProfileSchema,
});

/** Decoded JWT access-token payload shape — validated at runtime after signature verification. */
export const AccessTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  iat: z.number(),
  exp: z.number(),
});
