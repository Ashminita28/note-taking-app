import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SEARCH_QUERY_MAX_LENGTH } from '@note-app/shared';
import { Input } from '../../../components/ui/input';
import { isTypingTarget } from '../../../lib/dom';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { SEARCH_DEBOUNCE_MS } from '../search.constants';

const SEARCH_PATH = '/search';

/**
 * Self-contained: owns the raw keystroke state, debounces it, and imperatively navigates to
 * `/search?q=...` once settled — the URL only becomes the source of truth after the debounce
 * fires, not on every keystroke (plan.md Decision 2). Mounted inside `DashboardHeader`, so `Ctrl+K`
 * and `Escape` work identically on both `/` and `/search`.
 */
export function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(() =>
    location.pathname === SEARCH_PATH ? searchParams.get('q') ?? '' : '',
  );
  const debouncedValue = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  // Seeded from the initial value so landing directly on `/search?q=...` doesn't immediately
  // re-navigate to itself; updated every time this effect actually navigates.
  const lastNavigatedRef = useRef(value.trim());

  useEffect(() => {
    const trimmed = debouncedValue.trim();
    if (trimmed === lastNavigatedRef.current) {
      return;
    }
    lastNavigatedRef.current = trimmed;

    if (trimmed.length === 0) {
      if (location.pathname === SEARCH_PATH) {
        navigate('/');
      }
      return;
    }

    navigate(`${SEARCH_PATH}?q=${encodeURIComponent(trimmed)}`, { replace: location.pathname === SEARCH_PATH });
    // Only the debounced value should drive this — re-running on every `location`/`navigate`
    // identity change would fight the user's typing.
  }, [debouncedValue]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.ctrlKey && event.key.toLowerCase() === 'k' && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setValue(event.target.value.slice(0, SEARCH_QUERY_MAX_LENGTH));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setValue('');
      lastNavigatedRef.current = '';
      if (location.pathname === SEARCH_PATH) {
        navigate('/');
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      document.querySelector<HTMLElement>('[data-search-result]')?.focus();
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={handleInputKeyDown}
        placeholder="Search notes... (Ctrl+K)"
        aria-label="Search notes"
        className="pl-9"
      />
    </div>
  );
}
