import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_CODES } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { ApiError } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth.store';
import { loginUser } from '../auth.api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { PasswordInput } from './PasswordInput';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const navigate = useNavigate();
  const { isSubmitting, run } = useAsyncAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBannerError(null);

    const errors: FieldErrors = {
      email: email.trim() ? undefined : 'Email is required',
      password: password ? undefined : 'Password is required',
    };
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    try {
      const response = await run(() => loginUser({ email, password }));
      useAuthStore.getState().setTokens(response.accessToken, response.refreshToken);
      useAuthStore.getState().setUser(response.user);
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError && error.code === ERROR_CODES.INVALID_CREDENTIALS) {
        setBannerError('Invalid email or password');
        return;
      }
      setBannerError('Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {bannerError && (
        <p role="alert" aria-live="assertive" className="text-sm text-destructive">
          {bannerError}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        {fieldErrors.password && <p className="text-sm text-destructive">{fieldErrors.password}</p>}
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
