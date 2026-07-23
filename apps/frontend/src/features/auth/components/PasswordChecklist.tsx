import { Check, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { PASSWORD_RULES } from '../password-rules';

interface PasswordChecklistProps {
  password: string;
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  return (
    <ul className="space-y-1 text-sm" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn('flex items-center gap-2', passed ? 'text-green-600' : 'text-muted-foreground')}
          >
            {passed ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
