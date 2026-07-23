import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OtpInput } from '../../../../../src/features/auth/components/OtpInput';

function Wrapper() {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} />;
}

describe('OtpInput', () => {
  it('auto-advances focus after typing a digit', () => {
    render(<Wrapper />);
    const first = screen.getByLabelText('Digit 1 of 6');
    const second = screen.getByLabelText('Digit 2 of 6');

    fireEvent.change(first, { target: { value: '1' } });

    expect(second).toHaveFocus();
  });

  it('moves focus back on Backspace from an empty slot', () => {
    render(<Wrapper />);
    const first = screen.getByLabelText('Digit 1 of 6');
    const second = screen.getByLabelText('Digit 2 of 6');

    fireEvent.change(first, { target: { value: '1' } });
    second.focus();
    fireEvent.keyDown(second, { key: 'Backspace' });

    expect(first).toHaveFocus();
  });

  it('does not move focus back on Backspace from a filled slot', () => {
    render(<Wrapper />);
    const first = screen.getByLabelText('Digit 1 of 6');
    const second = screen.getByLabelText('Digit 2 of 6');

    fireEvent.change(first, { target: { value: '1' } });
    fireEvent.change(second, { target: { value: '2' } });
    second.focus();
    fireEvent.keyDown(second, { key: 'Backspace' });

    expect(second).toHaveFocus();
  });

  it('fills every slot from a pasted 6-digit string and focuses the last one', () => {
    render(<Wrapper />);
    const first = screen.getByLabelText('Digit 1 of 6');

    fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });

    for (let index = 1; index <= 6; index += 1) {
      expect(screen.getByLabelText(`Digit ${index} of 6`)).toHaveValue(String(index));
    }
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveFocus();
  });

  it('strips non-digit characters from a paste', () => {
    render(<Wrapper />);
    const first = screen.getByLabelText('Digit 1 of 6');

    fireEvent.paste(first, { clipboardData: { getData: () => '12-34a56' } });

    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('1');
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('6');
  });
});
