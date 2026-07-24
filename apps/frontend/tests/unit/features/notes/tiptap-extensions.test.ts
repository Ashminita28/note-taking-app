import { describe, it, expect } from 'vitest';
import { buildEditorExtensions } from '../../../../src/features/notes/tiptap-extensions';

/** Guards against silent drift from SDS §23.1's exact extension list (CON-001). */
describe('buildEditorExtensions', () => {
  it('configures exactly the extensions listed in SDS §23.1', () => {
    const extensions = buildEditorExtensions();
    const names = extensions.map((extension) => extension.name).sort();

    expect(names).toEqual(
      [
        'starterKit',
        'placeholder',
        'typography',
        'highlight',
        'link',
        // CodeBlockLowlight keeps the `codeBlock` node name so it can seamlessly replace
        // StarterKit's own (disabled) codeBlock extension in the schema.
        'codeBlock',
        'taskList',
        'taskItem',
        'underline',
        'textAlign',
        'characterCount',
      ].sort(),
    );
  });

  it('disables StarterKit’s own codeBlock so it never conflicts with codeBlockLowlight', () => {
    const extensions = buildEditorExtensions();
    const starterKit = extensions.find((extension) => extension.name === 'starterKit');

    expect(starterKit?.options.codeBlock).toBe(false);
  });

  it('configures Link to not open on click and to auto-link pasted/typed URLs', () => {
    const extensions = buildEditorExtensions();
    const link = extensions.find((extension) => extension.name === 'link');

    expect(link?.options.openOnClick).toBe(false);
    expect(link?.options.autolink).toBe(true);
    expect(link?.options.linkOnPaste).toBe(true);
  });

  it('configures the Placeholder text to "Start writing..." (UX §8.7 empty state)', () => {
    const extensions = buildEditorExtensions();
    const placeholder = extensions.find((extension) => extension.name === 'placeholder');

    expect(placeholder?.options.placeholder).toBe('Start writing...');
  });
});
