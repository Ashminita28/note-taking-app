import { ERROR_CODES } from '@note-app/shared';
import { useAuthStore } from '../stores/auth.store';

interface RequestConfig {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

interface RefreshResponseBody {
  accessToken: string;
  refreshToken: string;
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

const REFRESH_PATH = '/auth/refresh';

class ApiClient {
  private refreshPromise: Promise<void> | null = null;

  constructor(private readonly baseUrl: string = '/api') {}

  private getHeaders(): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return headers;
  }

  private async parseErrorPayload(response: Response): Promise<ApiError> {
    const payload = await response.json().catch(() => null);
    return new ApiError(
      response.status,
      payload?.error?.code ?? ERROR_CODES.INTERNAL_ERROR,
      payload?.error?.message ?? 'An unexpected error occurred. Please try again.',
      payload?.error?.details ?? [],
    );
  }

  /** Single-flight refresh: concurrent 401s share one in-flight `/auth/refresh` call. */
  private ensureFreshToken(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<void> {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      useAuthStore.getState().clearAuth();
      throw new ApiError(401, ERROR_CODES.INVALID_REFRESH_TOKEN, 'No refresh token available.');
    }

    const response = await fetch(`${this.baseUrl}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      useAuthStore.getState().clearAuth();
      throw await this.parseErrorPayload(response);
    }

    const data = (await response.json()) as RefreshResponseBody;
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
  }

  async request<T>(config: RequestConfig, isRetry = false): Promise<T> {
    const response = await fetch(`${this.baseUrl}${config.path}`, {
      method: config.method ?? 'GET',
      headers: this.getHeaders(),
      body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const error = await this.parseErrorPayload(response);

    if (response.status === 401) {
      const isExpiredAccessToken = error.code === ERROR_CODES.TOKEN_EXPIRED;
      const canAttemptRefresh = !isRetry && config.path !== REFRESH_PATH;

      if (isExpiredAccessToken && canAttemptRefresh) {
        await this.ensureFreshToken();
        return this.request(config, true);
      }

      if (error.code === ERROR_CODES.TOKEN_MISSING || error.code === ERROR_CODES.TOKEN_INVALID) {
        useAuthStore.getState().clearAuth();
      }
    }

    throw error;
  }
}

export const apiClient = new ApiClient();
export type { RequestConfig };
