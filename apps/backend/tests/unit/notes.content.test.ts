import { describe, it, expect } from 'vitest';
import { sanitizeNoteHtml, extractPlainText } from '../../src/modules/notes/notes.content';

describe('sanitizeNoteHtml', () => {
  it('strips disallowed tags such as <script>', () => {
    const result = sanitizeNoteHtml('<p>Hello <script>alert(1)</script>world</p>');
    expect(result).toBe('<p>Hello world</p>');
  });

  it('strips disallowed attributes such as onclick', () => {
    const result = sanitizeNoteHtml('<p onclick="alert(1)">Hi</p>');
    expect(result).toBe('<p>Hi</p>');
  });

  it('keeps whitelisted tags and attributes', () => {
    const result = sanitizeNoteHtml(
      '<p class="note"><strong>Bold</strong> <a href="https://example.com">link</a></p>',
    );
    expect(result).toBe(
      '<p class="note"><strong>Bold</strong> <a href="https://example.com">link</a></p>',
    );
  });

  it('strips a javascript: href scheme', () => {
    const result = sanitizeNoteHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).toBe('<a>click</a>');
  });

  it('keeps a checkbox input but restricts input to checkbox only', () => {
    const result = sanitizeNoteHtml(
      '<input type="checkbox" data-checked="true"><input type="text" value="x">',
    );
    expect(result).toContain('type="checkbox"');
    expect(result).not.toContain('type="text"');
  });

  it('restricts the style attribute to text-align', () => {
    const result = sanitizeNoteHtml('<p style="text-align: center; color: red;">Hi</p>');
    expect(result).toBe('<p style="text-align:center">Hi</p>');
  });

  it('returns an empty string for empty content', () => {
    expect(sanitizeNoteHtml('')).toBe('');
  });
});

describe('extractPlainText', () => {
  it('returns an empty string for empty content', () => {
    expect(extractPlainText('')).toBe('');
  });

  it('separates block elements with spacing rather than concatenating them', () => {
    const result = extractPlainText('<p>First paragraph</p><p>Second paragraph</p>');
    expect(result).toBe('First paragraph Second paragraph');
  });

  it('extracts text from nested inline and list elements', () => {
    const result = extractPlainText('<ul><li>One</li><li>Two</li></ul>');
    expect(result).toContain('One');
    expect(result).toContain('Two');
  });
});
