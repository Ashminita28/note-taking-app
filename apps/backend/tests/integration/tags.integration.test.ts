import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { resetNotesTables, registerAndLogin } from './setup';

const app = createApp();

beforeEach(async () => {
  await resetNotesTables();
});

afterAll(async () => {
  await resetNotesTables();
  await prisma.$disconnect();
});

describe('POST /api/tags', () => {
  it('creates a tag with a name and color', async () => {
    const { accessToken } = await registerAndLogin('create-happy@example.com');

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work', color: '#FF5733' });

    expect(res.status).toBe(201);
    expect(res.body.tag).toMatchObject({ name: 'Work', color: '#FF5733' });
    expect(res.body.tag.id).toEqual(expect.any(String));
  });

  it('defaults the color when omitted', async () => {
    const { accessToken } = await registerAndLogin('create-default-color@example.com');

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Personal' });

    expect(res.status).toBe(201);
    expect(res.body.tag.color).toBe('#6B7280');
  });

  it('trims leading/trailing whitespace from the name', async () => {
    const { accessToken } = await registerAndLogin('create-trim@example.com');

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '  Work  ' });

    expect(res.status).toBe(201);
    expect(res.body.tag.name).toBe('Work');

    const dupe = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work' });
    expect(dupe.status).toBe(409);
  });

  it('returns 409 TAG_NAME_EXISTS for a case-insensitive duplicate name', async () => {
    const { accessToken } = await registerAndLogin('create-dupe@example.com');
    await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work' });

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'WORK' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TAG_NAME_EXISTS');
  });

  it('returns 422 VALIDATION_ERROR when the name exceeds 50 characters', async () => {
    const { accessToken } = await registerAndLogin('create-too-long@example.com');

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'a'.repeat(51) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for an empty or whitespace-only name', async () => {
    const { accessToken } = await registerAndLogin('create-blank@example.com');

    const emptyRes = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });
    expect(emptyRes.status).toBe(422);

    const whitespaceRes = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' });
    expect(whitespaceRes.status).toBe(422);
  });

  it('returns 422 VALIDATION_ERROR for an invalid color', async () => {
    const { accessToken } = await registerAndLogin('create-bad-color@example.com');

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work', color: 'red' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('scopes tag name uniqueness per user', async () => {
    const userA = await registerAndLogin('scope-a@example.com');
    const userB = await registerAndLogin('scope-b@example.com');
    await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ name: 'Work' });

    const res = await supertest(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ name: 'Work' });

    expect(res.status).toBe(201);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await supertest(app).post('/api/tags').send({ name: 'Work' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tags', () => {
  it('returns tags with accurate note counts, excluding soft-deleted notes', async () => {
    const { accessToken, userId } = await registerAndLogin('list-counts@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work' } });
    const activeNote = await prisma.note.create({ data: { userId, title: 'Active' } });
    const deletedNote = await prisma.note.create({
      data: { userId, title: 'Deleted', deletedAt: new Date() },
    });
    await prisma.noteTag.createMany({
      data: [
        { noteId: activeNote.id, tagId: tag.id },
        { noteId: deletedNote.id, tagId: tag.id },
      ],
    });

    const res = await supertest(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([{ id: tag.id, name: 'Work', color: '#6B7280', noteCount: 1 }]);
  });

  it('includes tags with zero notes', async () => {
    const { accessToken, userId } = await registerAndLogin('list-zero@example.com');
    await prisma.tag.create({ data: { userId, name: 'Ideas' } });

    const res = await supertest(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([{ id: expect.any(String), name: 'Ideas', color: '#6B7280', noteCount: 0 }]);
  });

  it('returns tags sorted alphabetically by default', async () => {
    const { accessToken, userId } = await registerAndLogin('list-sort@example.com');
    await prisma.tag.createMany({
      data: [
        { userId, name: 'Work' },
        { userId, name: 'Archive' },
        { userId, name: 'Personal' },
      ],
    });

    const res = await supertest(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tags.map((t: { name: string }) => t.name)).toEqual([
      'Archive',
      'Personal',
      'Work',
    ]);
  });

  it('returns an empty list when the user has no tags', async () => {
    const { accessToken } = await registerAndLogin('list-empty@example.com');

    const res = await supertest(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
  });

  it('scopes results to the authenticated user only', async () => {
    const userA = await registerAndLogin('list-scope-a@example.com');
    const userB = await registerAndLogin('list-scope-b@example.com');
    await prisma.tag.create({ data: { userId: userA.userId, name: 'A-Only' } });
    await prisma.tag.create({ data: { userId: userB.userId, name: 'B-Only' } });

    const res = await supertest(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tags.map((t: { name: string }) => t.name)).toEqual(['A-Only']);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await supertest(app).get('/api/tags');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/tags/:id', () => {
  it('updates the name only', async () => {
    const { accessToken, userId } = await registerAndLogin('update-name@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work', color: '#FF5733' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Office' });

    expect(res.status).toBe(200);
    expect(res.body.tag).toMatchObject({ name: 'Office', color: '#FF5733' });
  });

  it('updates the color only', async () => {
    const { accessToken, userId } = await registerAndLogin('update-color@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work', color: '#FF5733' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ color: '#00FF00' });

    expect(res.status).toBe(200);
    expect(res.body.tag).toMatchObject({ name: 'Work', color: '#00FF00' });
  });

  it('updates both name and color', async () => {
    const { accessToken, userId } = await registerAndLogin('update-both@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work', color: '#FF5733' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Office', color: '#00FF00' });

    expect(res.status).toBe(200);
    expect(res.body.tag).toMatchObject({ name: 'Office', color: '#00FF00' });
  });

  it('preserves existing note associations after a rename', async () => {
    const { accessToken, userId } = await registerAndLogin('update-preserve@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work' } });
    const note = await prisma.note.create({ data: { userId, title: 'Note' } });
    await prisma.noteTag.create({ data: { noteId: note.id, tagId: tag.id } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Office' });

    expect(res.status).toBe(200);
    const association = await prisma.noteTag.findUnique({
      where: { noteId_tagId: { noteId: note.id, tagId: tag.id } },
    });
    expect(association).not.toBeNull();
  });

  it('allows renaming to a case-variant of its own current name', async () => {
    const { accessToken, userId } = await registerAndLogin('update-self-case@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'WORK', color: '#00FF00' });

    expect(res.status).toBe(200);
    expect(res.body.tag.name).toBe('WORK');
  });

  it('returns 404 TAG_NOT_FOUND for a nonexistent tag', async () => {
    const { accessToken } = await registerAndLogin('update-not-found@example.com');

    const res = await supertest(app)
      .patch('/api/tags/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Office' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAG_NOT_FOUND');
  });

  it('returns 404 TAG_NOT_FOUND for a tag owned by another user', async () => {
    const owner = await registerAndLogin('update-owner@example.com');
    const other = await registerAndLogin('update-other@example.com');
    const tag = await prisma.tag.create({ data: { userId: owner.userId, name: 'Work' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ name: 'Office' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAG_NOT_FOUND');
  });

  it('returns 409 TAG_NAME_EXISTS when the new name collides with a different tag', async () => {
    const { accessToken, userId } = await registerAndLogin('update-conflict@example.com');
    await prisma.tag.create({ data: { userId, name: 'Work' } });
    const personal = await prisma.tag.create({ data: { userId, name: 'Personal' } });

    const res = await supertest(app)
      .patch(`/api/tags/${personal.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'WORK' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TAG_NAME_EXISTS');
  });

  it('returns 422 VALIDATION_ERROR for invalid update fields', async () => {
    const { accessToken, userId } = await registerAndLogin('update-invalid@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work' } });

    const res = await supertest(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ color: 'not-a-color' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await supertest(app)
      .patch('/api/tags/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e')
      .send({ name: 'Office' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/tags/:id', () => {
  it('deletes the tag, cascades its note associations, and leaves the note itself intact', async () => {
    const { accessToken, userId } = await registerAndLogin('delete-happy@example.com');
    const tag = await prisma.tag.create({ data: { userId, name: 'Work' } });
    const note = await prisma.note.create({ data: { userId, title: 'Note' } });
    await prisma.noteTag.create({ data: { noteId: note.id, tagId: tag.id } });

    const res = await supertest(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toEqual(expect.any(String));

    const remainingTag = await prisma.tag.findUnique({ where: { id: tag.id } });
    expect(remainingTag).toBeNull();
    const remainingAssociation = await prisma.noteTag.findUnique({
      where: { noteId_tagId: { noteId: note.id, tagId: tag.id } },
    });
    expect(remainingAssociation).toBeNull();
    const remainingNote = await prisma.note.findUnique({ where: { id: note.id } });
    expect(remainingNote).not.toBeNull();
    expect(remainingNote?.deletedAt).toBeNull();
  });

  it('returns 404 TAG_NOT_FOUND for a nonexistent tag', async () => {
    const { accessToken } = await registerAndLogin('delete-not-found@example.com');

    const res = await supertest(app)
      .delete('/api/tags/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAG_NOT_FOUND');
  });

  it('returns 404 TAG_NOT_FOUND for a tag owned by another user', async () => {
    const owner = await registerAndLogin('delete-owner@example.com');
    const other = await registerAndLogin('delete-other@example.com');
    const tag = await prisma.tag.create({ data: { userId: owner.userId, name: 'Work' } });

    const res = await supertest(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAG_NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await supertest(app).delete('/api/tags/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');
    expect(res.status).toBe(401);
  });
});
