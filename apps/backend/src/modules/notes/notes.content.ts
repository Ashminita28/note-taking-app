import sanitizeHtmlLib, { type IOptions } from 'sanitize-html';
import { convert } from 'html-to-text';

const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'em',
  'strong',
  'u',
  's',
  'a',
  'br',
  'mark',
  'span',
  'div',
  'input',
  'label',
];

const ALLOWED_ATTRIBUTES: IOptions['allowedAttributes'] = {
  a: ['href'],
  input: ['type'],
  '*': ['class', 'data-type', 'data-checked', 'style'],
};

/** SDS §23.4 whitelist sanitizer — strips disallowed markup/attributes, never rejects (Scenario 9). */
export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
    // input is only ever a TipTap task-list checkbox — drop any other input entirely.
    exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  });
}

/** Block-aware HTML→plain-text (SDS §23.2) — paragraph/line breaks become spacing, not concatenation. */
export function extractPlainText(html: string): string {
  if (!html) {
    return '';
  }

  return convert(html, {
    wordwrap: false,
    selectors: [{ selector: 'a', options: { ignoreHref: true } }],
  })
    .replace(/\s+/g, ' ')
    .trim();
}
