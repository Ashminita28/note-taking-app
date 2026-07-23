import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast, useToast } from '../../../../src/components/ui/use-toast';

describe('useToast', () => {
  it('adds a toast that subscribers receive', () => {
    const { result } = renderHook(() => useToast());
    const before = result.current.toasts.length;

    act(() => {
      toast({ title: 'Saved' });
    });

    expect(result.current.toasts.length).toBe(before + 1);
    expect(result.current.toasts.at(-1)).toMatchObject({ title: 'Saved' });
  });

  it('dismiss removes the toast', () => {
    const { result } = renderHook(() => useToast());
    let id = '';
    act(() => {
      id = toast({ title: 'Temporary' });
    });
    expect(result.current.toasts.some((item) => item.id === id)).toBe(true);

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts.some((item) => item.id === id)).toBe(false);
  });
});
