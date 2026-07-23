import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_CODES } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from '../../../components/ui/use-toast';
import { ApiError } from '../../../lib/api-client';
import { forgotPassword } from '../auth.api';
import { getEmailError } from '../auth.validation';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { isSubmitting, run } = useAsyncAction();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();

    const error = getEmailError(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(undefined);

    try {
      await run(() => forgotPassword({ email }));
      navigate('/verify-otp', { state: { email: email.trim().toLowerCase() } });
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.code === ERROR_CODES.OTP_RATE_LIMIT) {
        toast({
          title: 'Too many requests',
          description: 'Please wait a while before requesting another code.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Enter your registered email and we&apos;ll send a 6-digit code (simulated via the backend
        console log) to reset your password.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(emailError)}
        />
        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send code'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
