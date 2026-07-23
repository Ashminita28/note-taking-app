import { useCallback, useState } from 'react';

export interface UseAsyncAction {
  isSubmitting: boolean;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
}

/** Shared submit-boilerplate: tracks `isSubmitting` around `fn`, rethrows on failure. */
export function useAsyncAction(): UseAsyncAction {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, run };
}
