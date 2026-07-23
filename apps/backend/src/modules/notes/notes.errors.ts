import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class NoteNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.');
  }
}

export class AlreadyDeletedError extends AppError {
  constructor() {
    super(ERROR_CODES.ALREADY_DELETED, 'This note has already been deleted.');
  }
}

export class NotDeletedError extends AppError {
  constructor() {
    super(ERROR_CODES.NOT_DELETED, 'This note is not deleted.');
  }
}

export class RecoveryExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.RECOVERY_EXPIRED, 'The 30-day recovery window for this note has expired.');
  }
}
