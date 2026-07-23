import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

interface AuthCardProps {
  title: string;
  children: ReactNode;
}

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </main>
  );
}
