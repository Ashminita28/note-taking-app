import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useNotesListParams } from '../../../../src/features/notes/useNotesListParams';

function wrapperWith(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useNotesListParams', () => {
  it('parses params from the URL', () => {
    const { result } = renderHook(() => useNotesListParams(), {
      wrapper: wrapperWith('/?page=2&sortBy=title&sortOrder=asc&tagIds=t1,t2&trash=1'),
    });
    expect(result.current.params).toEqual({
      page: 2,
      sortBy: 'title',
      sortOrder: 'asc',
      tagIds: ['t1', 't2'],
      trash: true,
    });
  });

  it('defaults when no params are present', () => {
    const { result } = renderHook(() => useNotesListParams(), { wrapper: wrapperWith('/') });
    expect(result.current.params).toEqual({
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      tagIds: [],
      trash: false,
    });
  });

  it('falls back to defaults for invalid sortBy/sortOrder/page', () => {
    const { result } = renderHook(() => useNotesListParams(), {
      wrapper: wrapperWith('/?page=abc&sortBy=bogus&sortOrder=bogus'),
    });
    expect(result.current.params.page).toBe(1);
    expect(result.current.params.sortBy).toBe('updatedAt');
    expect(result.current.params.sortOrder).toBe('desc');
  });

  it('setSort resets page to 1 and updates sortBy/sortOrder', () => {
    const { result } = renderHook(() => useNotesListParams(), { wrapper: wrapperWith('/?page=3') });
    act(() => result.current.setSort('createdAt', 'desc'));
    expect(result.current.params.sortBy).toBe('createdAt');
    expect(result.current.params.sortOrder).toBe('desc');
    expect(result.current.params.page).toBe(1);
  });

  it('toggleTag adds and then removes a tag, resetting page', () => {
    const { result } = renderHook(() => useNotesListParams(), { wrapper: wrapperWith('/?page=3') });

    act(() => result.current.toggleTag('t1'));
    expect(result.current.params.tagIds).toEqual(['t1']);
    expect(result.current.params.page).toBe(1);

    act(() => result.current.toggleTag('t1'));
    expect(result.current.params.tagIds).toEqual([]);
  });

  it('setTrash toggles the trash param and resets page', () => {
    const { result } = renderHook(() => useNotesListParams(), { wrapper: wrapperWith('/?page=2') });

    act(() => result.current.setTrash(true));
    expect(result.current.params.trash).toBe(true);
    expect(result.current.params.page).toBe(1);

    act(() => result.current.setTrash(false));
    expect(result.current.params.trash).toBe(false);
  });

  it('setPage updates the page param', () => {
    const { result } = renderHook(() => useNotesListParams(), { wrapper: wrapperWith('/') });
    act(() => result.current.setPage(5));
    expect(result.current.params.page).toBe(5);
  });
});
