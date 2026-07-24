import { describe, it, expect } from 'vitest';
import { parseSnippet } from '../../../../../src/features/search/utils/parseSnippet';

describe('parseSnippet', () => {
  it('returns a single non-highlighted segment for plain text', () => {
    expect(parseSnippet('hello world')).toEqual([{ text: 'hello world', highlighted: false }]);
  });

  it('marks text between <mark> and </mark> as highlighted', () => {
    expect(parseSnippet('the <mark>budget</mark> review')).toEqual([
      { text: 'the ', highlighted: false },
      { text: 'budget', highlighted: true },
      { text: ' review', highlighted: false },
    ]);
  });

  it('handles multiple highlight runs', () => {
    expect(parseSnippet('<mark>foo</mark> and <mark>bar</mark>')).toEqual([
      { text: 'foo', highlighted: true },
      { text: ' and ', highlighted: false },
      { text: 'bar', highlighted: true },
    ]);
  });

  it('preserves literal < and > characters outside any marker as plain text', () => {
    // ts_headline does not HTML-escape surrounding note content — this is the XSS-safety property
    // callers rely on: literal `<`/`>` must survive as plain text, never be dropped or reinterpreted.
    expect(parseSnippet('cost < revenue and profit <mark>margin</mark> > 0')).toEqual([
      { text: 'cost < revenue and profit ', highlighted: false },
      { text: 'margin', highlighted: true },
      { text: ' > 0', highlighted: false },
    ]);
  });

  it('returns an empty array for an empty snippet', () => {
    expect(parseSnippet('')).toEqual([]);
  });
});
