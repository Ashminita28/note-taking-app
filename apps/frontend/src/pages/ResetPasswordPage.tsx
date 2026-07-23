import { AuthCard } from '../features/auth/components/AuthCard';
import { ResetPasswordForm } from '../features/auth/components/ResetPasswordForm';

export function ResetPasswordPage() {
  return (
    <AuthCard title="Reset Password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
