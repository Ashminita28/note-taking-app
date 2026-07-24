import { describe, it, expect } from 'vitest';
import { findShareForNote } from '../../../../src/features/share/share.utils';

const share1 = { noteId: 'n1', noteTitle: 'A', url: 'https://x/shared/tok1', expiresAt: '', viewCount: 0, createdAt: '' };
const share2 = { noteId: 'n2', noteTitle: 'B', url: 'https://x/shared/tok2', expiresAt: '', viewCount: 3, createdAt: '' };

describe('findShareForNote', () => {
  it('returns the matching entry by noteId', () => {
    expect(findShareForNote([share1, share2], 'n2')).toBe(share2);
  });

  it('returns undefined when no entry matches', () => {
    expect(findShareForNote([share1, share2], 'n3')).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(findShareForNote([], 'n1')).toBeUndefined();
  });
});
