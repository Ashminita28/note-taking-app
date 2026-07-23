import { describe, it, expect } from 'vitest';
import {
  CreateTagRequestSchema,
  UpdateTagRequestSchema,
  TagIdParamSchema,
} from '../../src/schemas/tag.schemas';
import { TAG_NAME_MAX_LENGTH } from '../../src/constants/limits';
import { DEFAULT_TAG_COLOR } from '../../src/constants/defaults';

describe('CreateTagRequestSchema', () => {
  it('accepts a valid payload with name and color', () => {
    const result = CreateTagRequestSchema.safeParse({ name: 'Work', color: '#FF5733' });
    expect(result.success).toBe(true);
  });

  it('defaults color when omitted', () => {
    const result = CreateTagRequestSchema.parse({ name: 'Personal' });
    expect(result.color).toBe(DEFAULT_TAG_COLOR);
  });

  it('trims leading/trailing whitespace from name', () => {
    const result = CreateTagRequestSchema.parse({ name: '  Work  ' });
    expect(result.name).toBe('Work');
  });

  it('rejects an empty name', () => {
    expect(CreateTagRequestSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only name', () => {
    expect(CreateTagRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a name longer than the max length', () => {
    const result = CreateTagRequestSchema.safeParse({ name: 'a'.repeat(TAG_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed color', () => {
    expect(CreateTagRequestSchema.safeParse({ name: 'Work', color: 'red' }).success).toBe(false);
  });

  it('rejects a color missing the leading #', () => {
    expect(CreateTagRequestSchema.safeParse({ name: 'Work', color: 'FF5733' }).success).toBe(false);
  });

  it('rejects a color with invalid hex characters', () => {
    expect(CreateTagRequestSchema.safeParse({ name: 'Work', color: '#GGGGGG' }).success).toBe(false);
  });

  it('rejects a color of the wrong length', () => {
    expect(CreateTagRequestSchema.safeParse({ name: 'Work', color: '#FFF' }).success).toBe(false);
  });

  it('requires a name', () => {
    expect(CreateTagRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('UpdateTagRequestSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(UpdateTagRequestSchema.safeParse({}).success).toBe(true);
  });

  it('accepts name only', () => {
    expect(UpdateTagRequestSchema.safeParse({ name: 'Office' }).success).toBe(true);
  });

  it('accepts color only', () => {
    expect(UpdateTagRequestSchema.safeParse({ color: '#00FF00' }).success).toBe(true);
  });

  it('accepts both name and color', () => {
    expect(UpdateTagRequestSchema.safeParse({ name: 'Office', color: '#00FF00' }).success).toBe(true);
  });

  it('trims name whitespace when provided', () => {
    const result = UpdateTagRequestSchema.parse({ name: '  Office  ' });
    expect(result.name).toBe('Office');
  });

  it('rejects an empty name when provided', () => {
    expect(UpdateTagRequestSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects a name longer than the max length when provided', () => {
    const result = UpdateTagRequestSchema.safeParse({ name: 'a'.repeat(TAG_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed color when provided', () => {
    expect(UpdateTagRequestSchema.safeParse({ color: 'not-a-color' }).success).toBe(false);
  });
});

describe('TagIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(TagIdParamSchema.safeParse({ id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' }).success).toBe(
      true,
    );
  });

  it('rejects a non-UUID id', () => {
    expect(TagIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});
