import { AuthCard } from '../features/auth/components/AuthCard';
import { OtpForm } from '../features/auth/components/OtpForm';

export function VerifyOtpPage() {
  return (
    <AuthCard title="Verify OTP">
      <OtpForm />
    </AuthCard>
  );
}
