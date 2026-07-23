import { AuthCard } from '../features/auth/components/AuthCard';
import { ForgotPasswordForm } from '../features/auth/components/ForgotPasswordForm';

export function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot Password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
