import { describe, it, expect } from 'vitest';
import { queryClient } from '../../src/lib/query-client';

describe('queryClient', () => {
  it('is configured per SDS §21.2', () => {
    const { queries } = queryClient.getDefaultOptions();

    expect(queries?.staleTime).toBe(30 * 1000);
    expect(queries?.gcTime).toBe(5 * 60 * 1000);
    expect(queries?.retry).toBe(3);
    expect(queries?.refetchOnWindowFocus).toBe(true);
  });
});
