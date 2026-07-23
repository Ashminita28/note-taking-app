import { AuthCard } from '../features/auth/components/AuthCard';
import { RegisterForm } from '../features/auth/components/RegisterForm';

export function RegisterPage() {
  return (
    <AuthCard title="Register">
      <RegisterForm />
    </AuthCard>
  );
}
