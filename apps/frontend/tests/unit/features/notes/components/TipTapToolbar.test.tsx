import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TipTapToolbar } from '../../../../../src/features/notes/components/TipTapToolbar';

function createFakeEditor(activeMap: Record<string, boolean> = {}) {
  const calls: Record<string, number> = {};
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const handler = (prop: string) => (...args: unknown[]) => {
    if (prop === 'run') {
      calls.run = (calls.run ?? 0) + 1;
      return undefined;
    }
    const key = args.length > 0 ? `${prop}:${String(args[0])}` : prop;
    calls[key] = (calls[key] ?? 0) + 1;
    return chainProxy;
  };
  const chainProxy = new Proxy(chain, {
    get: (_target, prop: string) => handler(prop),
  });

  return {
    isActive: (nameOrAttrs: string | Record<string, string>) => {
      if (typeof nameOrAttrs === 'string') {
        return Boolean(activeMap[nameOrAttrs]);
      }
      const [key, value] = Object.entries(nameOrAttrs)[0];
      return Boolean(activeMap[`${key}:${value}`]);
    },
    chain: () => chainProxy,
    getAttributes: () => ({}),
    __calls: calls,
  };
}

describe('TipTapToolbar', () => {
  it('renders a button for every SDS §23.1 formatting action', () => {
    const editor = createFakeEditor();
    render(
      <TipTapToolbar editor={editor as never} linkPopoverOpen={false} onLinkPopoverOpenChange={() => {}} />,
    );

    [
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Highlight',
      'Bullet list',
      'Ordered list',
      'Task list',
      'Blockquote',
      'Inline code',
      'Code block',
      'Align left',
      'Align center',
      'Align right',
      'Insert link',
    ].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('clicking Bold runs the toggleBold command', () => {
    const editor = createFakeEditor();
    render(
      <TipTapToolbar editor={editor as never} linkPopoverOpen={false} onLinkPopoverOpenChange={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(editor.__calls.toggleBold).toBe(1);
    expect(editor.__calls.run).toBeGreaterThan(0);
  });

  it('reflects active marks via aria-pressed', () => {
    const editor = createFakeEditor({ bold: true, italic: false });
    render(
      <TipTapToolbar editor={editor as never} linkPopoverOpen={false} onLinkPopoverOpenChange={() => {}} />,
    );

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking an alignment button passes the alignment value', () => {
    const editor = createFakeEditor();
    render(
      <TipTapToolbar editor={editor as never} linkPopoverOpen={false} onLinkPopoverOpenChange={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Align center' }));

    expect(editor.__calls['setTextAlign:center']).toBe(1);
  });
});
