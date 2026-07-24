import { SHARE_EXPIRY_OPTIONS } from '../share.constants';
import { cn } from '../../../lib/utils';

interface ExpiryDropdownProps {
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
}

/** Native `<select>` (plan.md Decision 2) — no `@radix-ui/react-select` dependency is pinned (CON-001/CON-008). */
export function ExpiryDropdown({ value, onChange, disabled }: ExpiryDropdownProps) {
  return (
    <select
      aria-label="Link expiry"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {SHARE_EXPIRY_OPTIONS.map((option) => (
        <option key={option.hours} value={option.hours}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
