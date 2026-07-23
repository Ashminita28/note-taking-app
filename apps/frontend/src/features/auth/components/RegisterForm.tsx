import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_CODES, NAME_MAX_LENGTH } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from '../../../components/ui/use-toast';
import { ApiError } from '../../../lib/api-client';
import { registerUser } from '../auth.api';
import { getEmailError, getPasswordRuleError } from '../auth.validation';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { PasswordChecklist } from './PasswordChecklist';
import { PasswordInput } from './PasswordInput';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function getNameError(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or less`;
  return undefined;
}

const VALIDATION_ERROR_FIELDS = ['name', 'email', 'password'] as const;

export function RegisterForm() {
  const navigate = useNavigate();
  const { isSubmitting, run } = useAsyncAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBannerError(null);

    const errors: FieldErrors = {
      name: getNameError(name),
      email: getEmailError(email),
      password: getPasswordRuleError(password),
    };
    if (errors.name || errors.email || errors.password) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    try {
      await run(() => registerUser({ name: name.trim(), email: email.trim().toLowerCase(), password }));
      toast({ title: 'Account created! Please sign in.' });
      navigate('/login');
    } catch (error) {
      if (error instanceof ApiError && error.code === ERROR_CODES.EMAIL_ALREADY_EXISTS) {
        setBannerError('Email already registered');
        return;
      }
      if (error instanceof ApiError && error.code === ERROR_CODES.VALIDATION_ERROR) {
        const nextErrors: FieldErrors = {};
        for (const detail of error.details as Array<{ field: string; message: string }>) {
          if (VALIDATION_ERROR_FIELDS.includes(detail.field as (typeof VALIDATION_ERROR_FIELDS)[number])) {
            nextErrors[detail.field as keyof FieldErrors] = detail.message;
          }
        }
        setFieldErrors(nextErrors);
        return;
      }
      setBannerError('Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {bannerError && (
        <p role="alert" className="text-sm text-destructive">
          {bannerError}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
      </div>
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
        <PasswordChecklist password={password} />
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
