import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkPopover } from '../../../../../src/features/notes/components/LinkPopover';

function createFakeEditor(activeHref?: string) {
  const setLink = vi.fn();
  const unsetLink = vi.fn();
  const focus = vi.fn(() => ({ extendMarkRange: () => ({ setLink, run: setLink }), unsetLink, run: unsetLink }));
  return {
    isActive: (name: string) => name === 'link' && Boolean(activeHref),
    getAttributes: () => ({ href: activeHref }),
    chain: () => ({
      focus: () => ({
        extendMarkRange: () => ({ setLink: (attrs: unknown) => ({ run: () => setLink(attrs) }) }),
        unsetLink: () => ({ run: unsetLink }),
      }),
    }),
    __setLink: setLink,
    __unsetLink: unsetLink,
  } as unknown as { isActive: (n: string) => boolean; getAttributes: () => { href?: string } } & Record<
    string,
    unknown
  >;
}

describe('LinkPopover', () => {
  it('applies a link when the URL form is submitted', () => {
    const editor = createFakeEditor();
    const onOpenChange = vi.fn();

    render(<LinkPopover editor={editor as never} open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a "Remove link" action only when the selection is already a link', () => {
    const activeEditor = createFakeEditor('https://example.com');
    const { rerender } = render(<LinkPopover editor={activeEditor as never} open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove link' })).toBeInTheDocument();

    const inactiveEditor = createFakeEditor();
    rerender(<LinkPopover editor={inactiveEditor as never} open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Remove link' })).not.toBeInTheDocument();
  });
});
