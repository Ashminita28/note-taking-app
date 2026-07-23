import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
