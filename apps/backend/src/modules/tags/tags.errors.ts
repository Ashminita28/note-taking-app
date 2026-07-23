import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class TagNameExistsError extends AppError {
  constructor() {
    super(ERROR_CODES.TAG_NAME_EXISTS, 'A tag with this name already exists.');
  }
}

export class TagNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.TAG_NOT_FOUND, 'Tag not found.');
  }
}
