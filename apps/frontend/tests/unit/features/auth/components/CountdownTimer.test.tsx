import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountdownTimer } from '../../../../../src/features/auth/components/CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the initial mm:ss label and decrements', () => {
    render(<CountdownTimer totalSeconds={65} onExpire={() => {}} />);
    expect(screen.getByText('Resend code in 01:05')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Resend code in 01:04')).toBeInTheDocument();
  });

  it('calls onExpire exactly once when it reaches zero', () => {
    const onExpire = vi.fn();
    render(<CountdownTimer totalSeconds={2} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('You can resend the code now.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
