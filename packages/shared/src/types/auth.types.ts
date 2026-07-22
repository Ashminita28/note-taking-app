import type { z } from 'zod';
import type {
  UserProfileSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshRequestSchema,
  RefreshResponseSchema,
  LogoutRequestSchema,
  LogoutResponseSchema,
  MeResponseSchema,
  AccessTokenPayloadSchema,
} from '../schemas/auth.schemas.js';

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;
