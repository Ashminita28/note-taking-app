import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ERROR_CODES } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/use-toast';
import { ApiError } from '../../../lib/api-client';
import { forgotPassword, verifyOtp } from '../auth.api';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS } from '../auth.constants';
import type { ForgotPasswordLocationState } from '../auth.types';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { CountdownTimer } from './CountdownTimer';
import { OtpInput } from './OtpInput';

const OTP_LENGTH = 6;

export function OtpForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSubmitting, run } = useAsyncAction();
  const state = location.state as ForgotPasswordLocationState | null;

  const [otp, setOtp] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(OTP_MAX_ATTEMPTS);
  const [isExpired, setIsExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [shakeTrigger, setShakeTrigger] = useState(0);

  if (!state?.email) {
    return <Navigate to="/forgot-password" replace />;
  }
  const { email } = state;

  async function submitOtp(): Promise<void> {
    if (otp.length !== OTP_LENGTH || isExpired || isSubmitting) return;

    setErrorMessage(null);
    try {
      const response = await run(() => verifyOtp({ email, otp }));
      navigate('/reset-password', { state: { resetToken: response.resetToken } });
    } catch (error) {
      if (error instanceof ApiError && error.code === ERROR_CODES.INVALID_OTP) {
        const remaining = Math.max(attemptsRemaining - 1, 0);
        setAttemptsRemaining(remaining);
        setErrorMessage(`Incorrect code. ${remaining} attempts remaining.`);
        setOtp('');
        setShakeTrigger((count) => count + 1);
        return;
      }
      if (error instanceof ApiError && error.code === ERROR_CODES.OTP_EXPIRED) {
        setIsExpired(true);
        setErrorMessage('Code expired.');
        return;
      }
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  useEffect(() => {
    if (otp.length === OTP_LENGTH && !isExpired && !isSubmitting) {
      void submitOtp();
    }
  }, [otp]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await submitOtp();
  }

  async function handleResend(): Promise<void> {
    try {
      await forgotPassword({ email });
      setOtp('');
      setAttemptsRemaining(OTP_MAX_ATTEMPTS);
      setIsExpired(false);
      setErrorMessage(null);
      setTimerKey((key) => key + 1);
      toast({ title: 'A new code has been sent.' });
    } catch {
      toast({ title: 'Could not resend the code. Please try again.', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>
      <OtpInput
        value={otp}
        onChange={setOtp}
        length={OTP_LENGTH}
        disabled={isSubmitting || isExpired}
        shakeTrigger={shakeTrigger}
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <CountdownTimer
        key={timerKey}
        totalSeconds={OTP_RESEND_COOLDOWN_SECONDS}
        onExpire={() => setIsExpired(true)}
      />
      <Button type="submit" isLoading={isSubmitting} disabled={otp.length !== OTP_LENGTH || isExpired}>
        {isSubmitting ? 'Verifying...' : 'Verify'}
      </Button>
      <Button type="button" variant="outline" onClick={handleResend} disabled={isSubmitting || !isExpired}>
        Resend code
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Back to forgot password
        </Link>
      </p>
    </form>
  );
}
