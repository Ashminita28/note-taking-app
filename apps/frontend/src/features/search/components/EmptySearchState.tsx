interface EmptySearchStateProps {
  query: string;
}

export function EmptySearchState({ query }: EmptySearchStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">
        🔍
      </span>
      <p className="text-lg font-semibold text-foreground">No notes found for &quot;{query}&quot;</p>
      <p className="text-sm text-muted-foreground">Try different keywords or check spelling</p>
    </div>
  );
}
