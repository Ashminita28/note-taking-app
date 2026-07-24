import { describe, it, expect } from 'vitest';
import { isTypingTarget } from '../../../src/lib/dom';

describe('isTypingTarget', () => {
  it('returns true for an input element', () => {
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
  });

  it('returns true for a textarea element', () => {
    const textarea = document.createElement('textarea');
    expect(isTypingTarget(textarea)).toBe(true);
  });

  it('returns true for a select element', () => {
    const select = document.createElement('select');
    expect(isTypingTarget(select)).toBe(true);
  });

  it('returns true for a contenteditable element', () => {
    // jsdom does not implement the `contentEditable`/`isContentEditable` IDL attributes (it's on
    // jsdom's documented unimplemented-features list), so the property is stubbed directly here
    // to exercise `isTypingTarget`'s own branch rather than depending on unsupported DOM emulation.
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    expect(isTypingTarget(div)).toBe(true);
  });

  it('returns false for a plain element', () => {
    const div = document.createElement('div');
    expect(isTypingTarget(div)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});
