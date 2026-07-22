import type { ErrorCode } from '@note-app/shared';
import { ERROR_CODES, ERROR_HTTP_STATUS } from '@note-app/shared';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** Base class for all domain errors — caught by the global error handler and mapped to the standard error envelope (SDS §19.1). */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = ERROR_HTTP_STATUS[code];
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details: ErrorDetail[]) {
    super(ERROR_CODES.VALIDATION_ERROR, 'Validation failed.', details);
  }
}
