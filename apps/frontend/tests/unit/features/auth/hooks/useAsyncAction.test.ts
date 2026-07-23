import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncAction } from '../../../../../src/features/auth/hooks/useAsyncAction';

describe('useAsyncAction', () => {
  it('toggles isSubmitting around a resolving action', async () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.isSubmitting).toBe(false);

    let resolveFn: (() => void) | undefined;
    const pending = new Promise<string>((resolve) => {
      resolveFn = () => resolve('done');
    });

    let runPromise: Promise<string> | undefined;
    act(() => {
      runPromise = result.current.run(() => pending);
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    resolveFn?.();
    await act(async () => {
      await runPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('rethrows and resets isSubmitting on failure', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await expect(
      act(async () => {
        await result.current.run(() => Promise.reject(new Error('boom')));
      }),
    ).rejects.toThrow('boom');

    expect(result.current.isSubmitting).toBe(false);
  });
});
