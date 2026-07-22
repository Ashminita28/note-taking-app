import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import {
  AccessTokenPayloadSchema,
  type AccessTokenPayload,
  ResetTokenPayloadSchema,
  type ResetTokenPayload,
  OTP_LENGTH,
} from '@note-app/shared';
import { config } from '../../config/env.js';

export interface AccessTokenClaims {
  userId: string;
  email: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = {
    expiresIn: config.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
  };
  return jwt.sign(claims, config.JWT_SECRET, options);
}

/** Verifies the JWT signature/expiry, then validates the decoded payload shape. Lets `jsonwebtoken`'s errors (e.g. `TokenExpiredError`) propagate to the caller. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return AccessTokenPayloadSchema.parse(decoded);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Generates an opaque refresh token (SDS §10.2) — the raw value is returned to the client, only its SHA-256 hash is persisted. */
export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseExpiryToMs(config.JWT_REFRESH_EXPIRY));
  return { token, tokenHash, expiresAt };
}

export interface GeneratedOtp {
  otp: string;
  otpHash: string;
  expiresAt: Date;
}

/** Generates a 6-digit OTP via a CSPRNG (FR-PWD-001 AC2) — the raw value is only ever console-logged, its SHA-256 hash is persisted. */
export function generateOtp(): GeneratedOtp {
  const max = 10 ** OTP_LENGTH;
  const otp = randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60_000);
  return { otp, otpHash, expiresAt };
}

export interface ResetTokenClaims {
  userId: string;
  otpId: string;
}

/** Signs a stateless password-reset JWT (Architecture Decision #1, plan.md). Single-use is enforced separately via `PasswordResetOtp.resetTokenUsed`, not by this token's statelessness. */
export function signResetToken(claims: ResetTokenClaims): string {
  const options: SignOptions = {
    expiresIn: config.RESET_TOKEN_EXPIRY_MIN * 60,
  };
  return jwt.sign({ ...claims, purpose: 'password_reset' }, config.JWT_SECRET, options);
}

/** Verifies the JWT signature/expiry, then validates the decoded payload shape and `purpose` claim. Lets `jsonwebtoken`'s errors (e.g. `TokenExpiredError`) propagate to the caller. */
export function verifyResetToken(token: string): ResetTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return ResetTokenPayloadSchema.parse(decoded);
}

const DURATION_RE = /^(\d+)(s|m|h|d)$/;

/** Parses simple durations like "15m" or "7d" (the only formats used by JWT_ACCESS_EXPIRY/JWT_REFRESH_EXPIRY). */
function parseExpiryToMs(expiry: string): number {
  const match = DURATION_RE.exec(expiry);
  const amountStr = match?.[1];
  const unit = match?.[2];

  if (amountStr === undefined || unit === undefined) {
    throw new Error(`Unsupported duration format: "${expiry}". Expected e.g. "15m" or "7d".`);
  }

  const amount = Number(amountStr);

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      throw new Error(`Unsupported duration unit: "${unit}".`);
  }
}
