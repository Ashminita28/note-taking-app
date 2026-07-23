import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  totalSeconds: number;
  onExpire: () => void;
}

export function CountdownTimer({ totalSeconds, onExpire }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(totalSeconds);
    hasExpiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire();
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onExpire]);

  const minutes = Math.max(Math.floor(secondsLeft / 60), 0);
  const seconds = Math.max(secondsLeft % 60, 0);
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {secondsLeft > 0 ? `Resend code in ${label}` : 'You can resend the code now.'}
    </p>
  );
}
