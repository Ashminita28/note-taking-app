import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SEARCH_QUERY_MAX_LENGTH } from '@note-app/shared';
import { SearchBar } from '../../../../../src/features/search/components/SearchBar';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderSearchBar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchBar />
    </MemoryRouter>,
  );
}

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('focuses and selects the input on Ctrl+K', () => {
    renderSearchBar();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText('Search notes'));
  });

  it('ignores Ctrl+K while focus is already in a typing target', () => {
    renderSearchBar();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();

    fireEvent.keyDown(other, { key: 'k', ctrlKey: true });

    expect(document.activeElement).toBe(other);
    document.body.removeChild(other);
  });

  it('does not navigate while the debounce window has not elapsed', () => {
    renderSearchBar();
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'budget' } });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to /search with the query once the debounce elapses (push from Dashboard)', () => {
    renderSearchBar('/');
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'budget' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenCalledWith('/search?q=budget', { replace: false });
  });

  it('replaces instead of pushing when already on /search', () => {
    renderSearchBar('/search?q=old');
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'new' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenCalledWith('/search?q=new', { replace: true });
  });

  it('does not navigate when the input stays empty', () => {
    renderSearchBar();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('clears the query and navigates home on Escape when on /search', () => {
    renderSearchBar('/search?q=old');
    const input = screen.getByLabelText('Search notes');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('moves focus to the first search result on ArrowDown', () => {
    renderSearchBar();
    const target = document.createElement('a');
    target.setAttribute('data-search-result', '');
    target.tabIndex = 0;
    document.body.appendChild(target);

    fireEvent.keyDown(screen.getByLabelText('Search notes'), { key: 'ArrowDown' });

    expect(document.activeElement).toBe(target);
    document.body.removeChild(target);
  });

  it('caps the input value at SEARCH_QUERY_MAX_LENGTH', () => {
    renderSearchBar();
    const input = screen.getByLabelText('Search notes');
    const longValue = 'a'.repeat(SEARCH_QUERY_MAX_LENGTH + 50);

    fireEvent.change(input, { target: { value: longValue } });

    expect(input).toHaveValue('a'.repeat(SEARCH_QUERY_MAX_LENGTH));
  });
});
