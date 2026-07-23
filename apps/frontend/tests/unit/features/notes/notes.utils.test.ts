import { describe, it, expect } from 'vitest';
import { buildNotesQuery, stripHtmlToPlainText, truncate } from '../../../../src/features/notes/notes.utils';

describe('stripHtmlToPlainText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(stripHtmlToPlainText('<p>Hello <strong>world</strong></p>\n<p>Second</p>')).toBe('Hello world Second');
  });

  it('returns an empty string for empty content', () => {
    expect(stripHtmlToPlainText('')).toBe('');
  });
});

describe('truncate', () => {
  it('returns the original string when within the limit', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('truncates and appends an ellipsis when over the limit', () => {
    expect(truncate('this is a long string', 10)).toBe('this is a…');
  });
});

describe('buildNotesQuery', () => {
  it('includes page, sortBy, and sortOrder', () => {
    const query = buildNotesQuery({ page: 2, sortBy: 'title', sortOrder: 'asc', tagIds: [], trash: false });
    expect(query).toBe('page=2&sortBy=title&sortOrder=asc');
  });

  it('includes tagIds when present and not in trash view', () => {
    const query = buildNotesQuery({
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      tagIds: ['a', 'b'],
      trash: false,
    });
    expect(query).toContain('tagIds=a%2Cb');
  });

  it('omits tagIds and sets includeTrashed when trash is true', () => {
    const query = buildNotesQuery({
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      tagIds: ['a'],
      trash: true,
    });
    expect(query).toContain('includeTrashed=true');
    expect(query).not.toContain('tagIds');
  });
});
