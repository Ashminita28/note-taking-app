import { ERROR_CODES } from '@note-app/shared';
import { useAuthStore } from '../stores/auth.store';

interface RequestConfig {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}

class ApiClient {
  constructor(private readonly baseUrl: string = '/api') {}

  private getHeaders(): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return headers;
  }

  private handleUnauthorized(): void {
    useAuthStore.getState().clearAuth();
  }

  async request<T>(config: RequestConfig): Promise<T> {
    const response = await fetch(`${this.baseUrl}${config.path}`, {
      method: config.method ?? 'GET',
      headers: this.getHeaders(),
      body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
    });

    if (response.status === 401) {
      this.handleUnauthorized();
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        payload?.error?.code ?? ERROR_CODES.INTERNAL_ERROR,
        payload?.error?.message ?? 'An unexpected error occurred. Please try again.',
        payload?.error?.details ?? [],
      );
    }

    return (await response.json()) as T;
  }
}

export const apiClient = new ApiClient();
export type { RequestConfig };
