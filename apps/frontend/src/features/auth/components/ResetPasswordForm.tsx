import { useState } from 'react';
import type { FocusEvent, FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ERROR_CODES } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { toast } from '../../../components/ui/use-toast';
import { ApiError } from '../../../lib/api-client';
import { resetPassword } from '../auth.api';
import { getPasswordRuleError } from '../auth.validation';
import type { VerifyOtpLocationState } from '../auth.types';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { PasswordChecklist } from './PasswordChecklist';
import { PasswordInput } from './PasswordInput';

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
}

export function ResetPasswordForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSubmitting, run } = useAsyncAction();
  const state = location.state as VerifyOtpLocationState | null;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  if (!state?.resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }
  const { resetToken } = state;

  function checkConfirmMatch(nextConfirm: string): string | undefined {
    return nextConfirm && nextConfirm !== newPassword ? 'Passwords do not match' : undefined;
  }

  function handleConfirmBlur(event: FocusEvent<HTMLInputElement>): void {
    setFieldErrors((prev) => ({ ...prev, confirmPassword: checkConfirmMatch(event.target.value) }));
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBannerError(null);

    const errors: FieldErrors = {
      newPassword: getPasswordRuleError(newPassword),
      confirmPassword: confirmPassword !== newPassword ? 'Passwords do not match' : undefined,
    };
    if (errors.newPassword || errors.confirmPassword) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    try {
      await run(() => resetPassword({ resetToken, newPassword }));
      toast({ title: 'Password reset successful! Please sign in.' });
      navigate('/login');
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === ERROR_CODES.RESET_TOKEN_EXPIRED || error.code === ERROR_CODES.INVALID_RESET_TOKEN)
      ) {
        setBannerError('This reset link is no longer valid. Please request a new code.');
        return;
      }
      if (error instanceof ApiError && error.code === ERROR_CODES.PASSWORD_SAME_AS_CURRENT) {
        setBannerError('New password must be different from your current password.');
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
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.newPassword)}
        />
        {fieldErrors.newPassword && <p className="text-sm text-destructive">{fieldErrors.newPassword}</p>}
        <PasswordChecklist password={newPassword} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={handleConfirmBlur}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
        />
        {fieldErrors.confirmPassword && (
          <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
        )}
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Resetting...' : 'Reset password'}
      </Button>
    </form>
  );
}
