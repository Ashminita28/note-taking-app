import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class VersionNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.VERSION_NOT_FOUND, 'Version not found.');
  }
}
