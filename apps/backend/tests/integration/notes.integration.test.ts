import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { signAccessToken } from '../../src/modules/auth/auth.tokens';
import { resetNotesTables } from './setup';

const app = createApp();

/**
 * Creates a user directly via Prisma and signs its access token in-process — notes tests exercise
 * the notes endpoints, not the login flow (AB-1002's concern), and going through the real
 * register/login HTTP endpoints for every one of this suite's users would run the global rate
 * limiter dry well before the suite finishes.
 */
async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  const user = await prisma.user.create({
    data: { name: 'Note Tester', email, passwordHash: 'unused-in-notes-tests' },
  });
  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  return { accessToken, userId: user.id };
}

async function createTag(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { userId, name } });
  return tag.id;
}

beforeEach(async () => {
  await resetNotesTables();
});

afterAll(async () => {
  await resetNotesTables();
  await prisma.$disconnect();
});

describe('POST /api/notes', () => {
  it('creates a note with title and content, sanitizing content and snapshotting version 1', async () => {
    const { accessToken } = await registerAndLogin('create-happy@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Groceries', content: '<p>Milk, eggs</p>' });

    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({
      title: 'Groceries',
      content: '<p>Milk, eggs</p>',
      tags: [],
    });
    expect(res.body.note.id).toEqual(expect.any(String));

    const versions = await prisma.noteVersion.findMany({ where: { noteId: res.body.note.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ versionNumber: 1, title: 'Groceries' });
  });

  it('defaults title to "Untitled" when omitted', async () => {
    const { accessToken } = await registerAndLogin('create-default-title@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.note.title).toBe('Untitled');
  });

  it('trims leading/trailing whitespace from the title', async () => {
    const { accessToken } = await registerAndLogin('create-trim@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '  My Note  ' });

    expect(res.status).toBe(201);
    expect(res.body.note.title).toBe('My Note');
  });

  it('allows an empty content field', async () => {
    const { accessToken } = await registerAndLogin('create-empty-content@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'No content' });

    expect(res.status).toBe(201);
    expect(res.body.note.content).toBe('');
  });

  it('associates owned tags at creation time', async () => {
    const { accessToken, userId } = await registerAndLogin('create-tags@example.com');
    const tag1 = await createTag(userId, 'home');
    const tag2 = await createTag(userId, 'work');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Note', tagIds: [tag1, tag2] });

    expect(res.status).toBe(201);
    expect(res.body.note.tags.map((t: { id: string }) => t.id).sort()).toEqual(
      [tag1, tag2].sort(),
    );
  });

  it('returns 422 VALIDATION_ERROR when the title exceeds 255 characters', async () => {
    const { accessToken } = await registerAndLogin('create-title-too-long@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(256) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'title')).toBe(true);
  });

  it('returns 413 CONTENT_TOO_LARGE for a content payload exceeding 500KB', async () => {
    const { accessToken } = await registerAndLogin('create-too-large@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Huge', content: 'a'.repeat(600 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('CONTENT_TOO_LARGE');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await supertest(app).post('/api/notes').send({ title: 'Note' });

    expect(res.status).toBe(401);
  });

  it('strips disallowed markup instead of rejecting the request', async () => {
    const { accessToken } = await registerAndLogin('create-strip-html@example.com');

    const res = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'XSS test', content: '<p onclick="evil()">Hi <script>alert(1)</script></p>' });

    expect(res.status).toBe(201);
    expect(res.body.note.content).toBe('<p>Hi </p>');
  });
});

describe('GET /api/notes/:id', () => {
  it('returns the note when owned by the authenticated user', async () => {
    const { accessToken } = await registerAndLogin('read-happy@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Readable' });

    const res = await supertest(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('Readable');
  });

  it('returns 404 NOTE_NOT_FOUND for a non-existent note', async () => {
    const { accessToken } = await registerAndLogin('read-missing@example.com');

    const res = await supertest(app)
      .get('/api/notes/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 404 NOTE_NOT_FOUND for a note owned by another user', async () => {
    const owner = await registerAndLogin('read-owner@example.com');
    const other = await registerAndLogin('read-other@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner note' });

    const res = await supertest(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 404 NOTE_NOT_FOUND for a soft-deleted note', async () => {
    const { accessToken } = await registerAndLogin('read-deleted@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To delete' });
    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await supertest(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await supertest(app).get('/api/notes/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('applies a full update and replaces tag associations atomically', async () => {
    const { accessToken, userId } = await registerAndLogin('update-happy@example.com');
    const tag1 = await createTag(userId, 't1');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original' });

    const res = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'New title', content: '<p>New</p>', tagIds: [tag1] });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('New title');
    expect(res.body.note.content).toBe('<p>New</p>');
    expect(res.body.note.tags.map((t: { id: string }) => t.id)).toEqual([tag1]);
  });

  it('creates a version snapshot on a title-only partial update', async () => {
    const { accessToken } = await registerAndLogin('update-partial@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original', content: '<p>Body</p>' });

    const res = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('Renamed');
    expect(res.body.note.content).toBe('<p>Body</p>');

    const versions = await prisma.noteVersion.findMany({
      where: { noteId: created.body.note.id },
      orderBy: { versionNumber: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({ versionNumber: 2, title: 'Renamed', content: '<p>Body</p>' });
  });

  it('replaces tag associations atomically, removing, keeping, and adding tags', async () => {
    const { accessToken, userId } = await registerAndLogin('update-tags@example.com');
    const tag1 = await createTag(userId, 't1');
    const tag2 = await createTag(userId, 't2');
    const tag3 = await createTag(userId, 't3');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tagged', tagIds: [tag1, tag2] });

    const res = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagIds: [tag2, tag3] });

    expect(res.status).toBe(200);
    expect(res.body.note.tags.map((t: { id: string }) => t.id).sort()).toEqual(
      [tag2, tag3].sort(),
    );
  });

  it('returns 404 NOTE_NOT_FOUND for a non-existent, foreign, or soft-deleted note', async () => {
    const owner = await registerAndLogin('update-owner@example.com');
    const other = await registerAndLogin('update-other@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner note' });

    const foreignRes = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ title: 'Hijacked' });
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body.error.code).toBe('NOTE_NOT_FOUND');

    const missingRes = await supertest(app)
      .patch('/api/notes/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Ghost' });
    expect(missingRes.status).toBe(404);

    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const deletedRes = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Resurrect' });
    expect(deletedRes.status).toBe(404);
  });

  it('returns 422 VALIDATION_ERROR when the title exceeds 255 characters', async () => {
    const { accessToken } = await registerAndLogin('update-title-too-long@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original' });

    const res = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(256) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 413 CONTENT_TOO_LARGE for a content payload exceeding 500KB', async () => {
    const { accessToken } = await registerAndLogin('update-too-large@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original' });

    const res = await supertest(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'a'.repeat(600 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('CONTENT_TOO_LARGE');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await supertest(app)
      .patch('/api/notes/00000000-0000-4000-8000-000000000000')
      .send({ title: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('soft-deletes the note and hard-deletes its active share link', async () => {
    const { accessToken } = await registerAndLogin('delete-happy@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To delete' });
    await prisma.shareLink.create({
      data: {
        noteId: created.body.note.id,
        token: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toEqual(expect.any(String));

    const note = await prisma.note.findUniqueOrThrow({ where: { id: created.body.note.id } });
    expect(note.deletedAt).not.toBeNull();
    const shareLink = await prisma.shareLink.findUnique({ where: { noteId: created.body.note.id } });
    expect(shareLink).toBeNull();
  });

  it('succeeds when the note has no active share link', async () => {
    const { accessToken } = await registerAndLogin('delete-no-share@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To delete' });

    const res = await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 NOTE_NOT_FOUND for a non-existent or foreign note', async () => {
    const owner = await registerAndLogin('delete-owner@example.com');
    const other = await registerAndLogin('delete-other@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner note' });

    const foreignRes = await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(foreignRes.status).toBe(404);

    const missingRes = await supertest(app)
      .delete('/api/notes/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(missingRes.status).toBe(404);
  });

  it('returns 409 ALREADY_DELETED when the note is already soft-deleted', async () => {
    const { accessToken } = await registerAndLogin('delete-twice@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To delete' });
    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_DELETED');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await supertest(app).delete('/api/notes/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/notes/:id/restore', () => {
  it('restores a note soft-deleted within the 30-day window', async () => {
    const { accessToken } = await registerAndLogin('restore-happy@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To restore' });
    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await prisma.note.update({
      where: { id: created.body.note.id },
      data: { deletedAt: new Date(Date.now() - 10 * 86_400_000) },
    });

    const res = await supertest(app)
      .post(`/api/notes/${created.body.note.id}/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.note.id).toBe(created.body.note.id);

    const readRes = await supertest(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(readRes.status).toBe(200);
  });

  it('returns 404 NOTE_NOT_FOUND for a non-existent or foreign note', async () => {
    const owner = await registerAndLogin('restore-owner@example.com');
    const other = await registerAndLogin('restore-other@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner note' });
    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const foreignRes = await supertest(app)
      .post(`/api/notes/${created.body.note.id}/restore`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(foreignRes.status).toBe(404);

    const missingRes = await supertest(app)
      .post('/api/notes/00000000-0000-4000-8000-000000000000/restore')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(missingRes.status).toBe(404);
  });

  it('returns 409 NOT_DELETED when the note is not soft-deleted', async () => {
    const { accessToken } = await registerAndLogin('restore-not-deleted@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Not deleted' });

    const res = await supertest(app)
      .post(`/api/notes/${created.body.note.id}/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_DELETED');
  });

  it('returns 410 RECOVERY_EXPIRED when the 30-day window has passed', async () => {
    const { accessToken } = await registerAndLogin('restore-expired@example.com');
    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Long gone' });
    await supertest(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await prisma.note.update({
      where: { id: created.body.note.id },
      data: { deletedAt: new Date(Date.now() - 31 * 86_400_000) },
    });

    const res = await supertest(app)
      .post(`/api/notes/${created.body.note.id}/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('RECOVERY_EXPIRED');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await supertest(app).post(
      '/api/notes/00000000-0000-4000-8000-000000000000/restore',
    );

    expect(res.status).toBe(401);
  });
});
