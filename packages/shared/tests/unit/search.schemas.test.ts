import { describe, it, expect } from 'vitest';
import { SearchQuerySchema } from '../../src/schemas/search.schemas';
import { SEARCH_QUERY_MAX_LENGTH } from '../../src/constants/limits';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../src/constants/defaults';

describe('SearchQuerySchema', () => {
  it('accepts a valid query with just q', () => {
    const result = SearchQuerySchema.parse({ q: 'standup' });
    expect(result.q).toBe('standup');
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.tagIds).toBeUndefined();
  });

  it('trims leading/trailing whitespace from q', () => {
    const result = SearchQuerySchema.parse({ q: '  standup  ' });
    expect(result.q).toBe('standup');
  });

  it('rejects a missing q', () => {
    expect(SearchQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty q', () => {
    expect(SearchQuerySchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only q', () => {
    expect(SearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
  });

  it('rejects a q longer than the max length', () => {
    const result = SearchQuerySchema.safeParse({ q: 'a'.repeat(SEARCH_QUERY_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('accepts a q exactly at the max length', () => {
    const result = SearchQuerySchema.safeParse({ q: 'a'.repeat(SEARCH_QUERY_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it('coerces page and pageSize from query-string values', () => {
    const result = SearchQuerySchema.parse({ q: 'standup', page: '2', pageSize: '10' });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('rejects page 0', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', page: '0' }).success).toBe(false);
  });

  it('rejects a negative page', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', page: '-1' }).success).toBe(false);
  });

  it('rejects a non-integer page', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', page: '1.5' }).success).toBe(false);
  });

  it('rejects pageSize 0', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', pageSize: '0' }).success).toBe(false);
  });

  it('rejects a pageSize over the max', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', pageSize: '101' }).success).toBe(false);
  });

  it('accepts a pageSize at the max', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', pageSize: '100' }).success).toBe(true);
  });

  it('parses a comma-separated tagIds list into a UUID array', () => {
    const result = SearchQuerySchema.parse({
      q: 'standup',
      tagIds: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e,c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
    });
    expect(result.tagIds).toEqual([
      'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
    ]);
  });

  it('parses a single tagIds value into a one-element array', () => {
    const result = SearchQuerySchema.parse({
      q: 'standup',
      tagIds: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    });
    expect(result.tagIds).toEqual(['b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e']);
  });

  it('rejects a malformed UUID in tagIds', () => {
    expect(SearchQuerySchema.safeParse({ q: 'standup', tagIds: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a malformed UUID among otherwise-valid tagIds', () => {
    const result = SearchQuerySchema.safeParse({
      q: 'standup',
      tagIds: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e,not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});
