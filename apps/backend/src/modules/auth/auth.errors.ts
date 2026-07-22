import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(ERROR_CODES.EMAIL_ALREADY_EXISTS, 'An account with this email already exists.');
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password.');
  }
}

export class AccessTokenMissingError extends AppError {
  constructor() {
    super(ERROR_CODES.TOKEN_MISSING, 'Authentication required.');
  }
}

export class AccessTokenExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.TOKEN_EXPIRED, 'Session expired. Please log in again.');
  }
}

export class AccessTokenInvalidError extends AppError {
  constructor() {
    super(ERROR_CODES.TOKEN_INVALID, 'Invalid authentication token.');
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Invalid refresh token.');
  }
}

export class RefreshTokenExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.REFRESH_TOKEN_EXPIRED, 'Refresh token expired. Please log in again.');
  }
}

export class InvalidOtpError extends AppError {
  constructor() {
    super(ERROR_CODES.INVALID_OTP, 'The code you entered is incorrect.');
  }
}

export class OtpExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.OTP_EXPIRED, 'This code has expired. Request a new one.');
  }
}

export class InvalidResetTokenError extends AppError {
  constructor() {
    super(ERROR_CODES.INVALID_RESET_TOKEN, 'Invalid password reset link.');
  }
}

export class ResetTokenExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.RESET_TOKEN_EXPIRED, 'Password reset link expired. Request a new one.');
  }
}

export class PasswordSameAsCurrentError extends AppError {
  constructor() {
    super(
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      'New password must be different from the current.',
    );
  }
}
