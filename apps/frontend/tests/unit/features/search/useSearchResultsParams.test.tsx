import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSearchResultsParams } from '../../../../src/features/search/useSearchResultsParams';

function wrapperWith(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useSearchResultsParams', () => {
  it('parses q and page from the URL', () => {
    const { result } = renderHook(() => useSearchResultsParams(), {
      wrapper: wrapperWith('/search?q=budget&page=2'),
    });
    expect(result.current.params).toEqual({ q: 'budget', page: 2 });
  });

  it('defaults page to 1 and q to an empty string when absent', () => {
    const { result } = renderHook(() => useSearchResultsParams(), { wrapper: wrapperWith('/search') });
    expect(result.current.params).toEqual({ q: '', page: 1 });
  });

  it('falls back to page 1 for an invalid page value', () => {
    const { result } = renderHook(() => useSearchResultsParams(), {
      wrapper: wrapperWith('/search?q=budget&page=abc'),
    });
    expect(result.current.params.page).toBe(1);
  });

  it('setPage updates the page param and preserves q', () => {
    const { result } = renderHook(() => useSearchResultsParams(), {
      wrapper: wrapperWith('/search?q=budget'),
    });
    act(() => result.current.setPage(3));
    expect(result.current.params).toEqual({ q: 'budget', page: 3 });
  });
});
