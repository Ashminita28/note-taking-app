import { Link } from 'react-router-dom';
import type { SearchResult } from '@note-app/shared';
import { SnippetHighlight } from './SnippetHighlight';

interface SearchResultItemProps {
  result: SearchResult;
}

export function SearchResultItem({ result }: SearchResultItemProps) {
  return (
    <Link
      to={`/notes/${result.id}`}
      data-search-result
      className="block rounded-md border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="truncate text-base font-semibold text-foreground">{result.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        <SnippetHighlight snippet={result.snippet} />
      </p>
    </Link>
  );
}
