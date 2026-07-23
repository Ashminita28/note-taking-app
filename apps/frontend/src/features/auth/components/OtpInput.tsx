import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from '../../../lib/utils';

const SHAKE_DURATION_MS = 400;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Bump this (e.g. an incrementing counter) to re-trigger the shake animation on each failed attempt. */
  shakeTrigger?: number;
}

export function OtpInput({ value, onChange, length = 6, disabled = false, shakeTrigger = 0 }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (shakeTrigger === 0) return;
    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), SHAKE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shakeTrigger]);

  function setDigit(index: number, digit: string): void {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>): void {
    const digit = event.target.value.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && !digits[index]) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted.slice(0, length));
    const lastIndex = Math.min(pasted.length, length) - 1;
    inputRefs.current[Math.max(lastIndex, 0)]?.focus();
  }

  return (
    <div className={cn('flex justify-between gap-2', isShaking && 'animate-shake')}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={cn(
            'h-12 w-10 rounded-md border border-input bg-background text-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      ))}
    </div>
  );
}
