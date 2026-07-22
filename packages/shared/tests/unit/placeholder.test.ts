import { describe, it, expect } from 'vitest';
import { ERROR_CODES, ERROR_HTTP_STATUS, DEFAULT_PAGE_SIZE } from '../../src/index';

describe('shared package barrel exports', () => {
  it('resolves ERROR_CODES and their matching HTTP status', () => {
    expect(ERROR_CODES.NOTE_NOT_FOUND).toBe('NOTE_NOT_FOUND');
    expect(ERROR_HTTP_STATUS[ERROR_CODES.NOTE_NOT_FOUND]).toBe(404);
  });

  it('resolves default constants', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });
});
