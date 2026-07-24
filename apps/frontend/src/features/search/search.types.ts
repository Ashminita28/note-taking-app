/** URL-search-params-backed query state — not a request/response shape, so it stays local to this feature. */
export interface SearchListParams {
  q: string;
  page: number;
}
