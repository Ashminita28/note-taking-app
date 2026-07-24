import { Fragment } from 'react';
import { parseSnippet } from '../utils/parseSnippet';

interface SnippetHighlightProps {
  snippet: string;
}

/**
 * Renders every segment as a React text child (auto-escaped) — highlighted segments inside a real
 * `<mark>`, everything else as plain text. Never uses `dangerouslySetInnerHTML`: `ts_headline`
 * leaves surrounding note content un-escaped, so blind HTML injection here would let literal
 * `<`/`>` characters a user typed into a note execute as markup.
 */
export function SnippetHighlight({ snippet }: SnippetHighlightProps) {
  const segments = parseSnippet(snippet);

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
