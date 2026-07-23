import { ERROR_CODES } from '@note-app/shared';
import { AppError } from '../../errors/app-error.js';

export class ShareLinkNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.SHARE_LINK_NOT_FOUND, 'Share link not found.');
  }
}

export class ShareLinkExpiredError extends AppError {
  constructor() {
    super(ERROR_CODES.SHARE_LINK_EXPIRED, 'This share link has expired.');
  }
}
