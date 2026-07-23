import { describe, it, expect } from 'vitest';
import {
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  NoteResponseSchema,
  NoteIdParamSchema,
} from '../../src/schemas/note.schemas';
import { NOTE_TITLE_MAX_LENGTH } from '../../src/constants/limits';
import { DEFAULT_NOTE_TITLE } from '../../src/constants/defaults';

describe('CreateNoteRequestSchema', () => {
  it('accepts a valid payload with title, content, and tagIds', () => {
    const result = CreateNoteRequestSchema.safeParse({
      title: 'Groceries',
      content: '<p>Milk, eggs</p>',
      tagIds: ['b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'],
    });
    expect(result.success).toBe(true);
  });

  it('defaults title to "Untitled" when omitted', () => {
    const result = CreateNoteRequestSchema.parse({});
    expect(result.title).toBe(DEFAULT_NOTE_TITLE);
  });

  it('defaults title to "Untitled" when blank', () => {
    const result = CreateNoteRequestSchema.parse({ title: '' });
    expect(result.title).toBe(DEFAULT_NOTE_TITLE);
  });

  it('trims leading/trailing whitespace from title', () => {
    const result = CreateNoteRequestSchema.parse({ title: '  My Note  ' });
    expect(result.title).toBe('My Note');
  });

  it('defaults content to an empty string when omitted', () => {
    const result = CreateNoteRequestSchema.parse({});
    expect(result.content).toBe('');
  });

  it('rejects a title longer than the max length', () => {
    const result = CreateNoteRequestSchema.safeParse({
      title: 'a'.repeat(NOTE_TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID tagId', () => {
    const result = CreateNoteRequestSchema.safeParse({ tagIds: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });
});

describe('UpdateNoteRequestSchema', () => {
  it('accepts a partial payload with only title', () => {
    expect(UpdateNoteRequestSchema.safeParse({ title: 'Renamed' }).success).toBe(true);
  });

  it('leaves title undefined when omitted (no default on update)', () => {
    const result = UpdateNoteRequestSchema.parse({});
    expect(result.title).toBeUndefined();
  });

  it('defaults an explicitly blank title to "Untitled"', () => {
    const result = UpdateNoteRequestSchema.parse({ title: '' });
    expect(result.title).toBe(DEFAULT_NOTE_TITLE);
  });

  it('trims title whitespace', () => {
    const result = UpdateNoteRequestSchema.parse({ title: '  Renamed  ' });
    expect(result.title).toBe('Renamed');
  });

  it('rejects a title longer than the max length', () => {
    const result = UpdateNoteRequestSchema.safeParse({
      title: 'a'.repeat(NOTE_TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID tagId', () => {
    expect(UpdateNoteRequestSchema.safeParse({ tagIds: ['not-a-uuid'] }).success).toBe(false);
  });
});

describe('NoteResponseSchema', () => {
  it('accepts a well-formed note response', () => {
    const result = NoteResponseSchema.safeParse({
      id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      title: 'Groceries',
      content: '<p>Milk</p>',
      tags: [{ id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6f', name: 'home', color: '#6B7280' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const result = NoteResponseSchema.safeParse({
      id: 'not-a-uuid',
      title: 'Groceries',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('NoteIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      NoteIdParamSchema.safeParse({ id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(NoteIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});
