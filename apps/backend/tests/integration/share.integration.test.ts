import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { resetNotesTables, registerAndLogin } from './setup';

const app = createApp();

async function createNoteDirect(
  userId: string,
  overrides: { title?: string; content?: string; deletedAt?: Date | null } = {},
): Promise<{ id: string }> {
  return prisma.note.create({
    data: {
      userId,
      title: overrides.title ?? 'Untitled',
      content: overrides.content ?? '',
      ...(overrides.deletedAt !== undefined ? { deletedAt: overrides.deletedAt } : {}),
    },
  });
}

async function createShareLinkDirect(
  noteId: string,
  overrides: { token?: string; expiresAt?: Date; viewCount?: number } = {},
): Promise<{ token: string; expiresAt: Date }> {
  return prisma.shareLink.create({
    data: {
      noteId,
      token: overrides.token ?? randomUUID(),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 86_400_000),
      viewCount: overrides.viewCount ?? 0,
    },
  });
}

beforeEach(async () => {
  await resetNotesTables();
});

afterAll(async () => {
  await resetNotesTables();
  await prisma.$disconnect();
});

describe('POST /api/notes/:id/share', () => {
  it('Scenario 1 — generates a share link with the default 7-day expiry', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-default@example.com');
    const note = await createNoteDirect(userId, { title: 'My Note' });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.shareLink).toMatchObject({ viewCount: 0 });
    expect(res.body.shareLink.token).toEqual(expect.any(String));
    expect(res.body.shareLink.url).toContain(`/shared/${res.body.shareLink.token}`);

    const expiresAt = new Date(res.body.shareLink.expiresAt);
    const createdAt = new Date(res.body.shareLink.createdAt);
    const diffHours = (expiresAt.getTime() - createdAt.getTime()) / 3_600_000;
    expect(diffHours).toBeCloseTo(168, 0);
  });

  it('Scenario 2 — generates a share link with a custom expiry', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-custom@example.com');
    const note = await createNoteDirect(userId);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 24 });

    expect(res.status).toBe(201);
    const expiresAt = new Date(res.body.shareLink.expiresAt);
    const createdAt = new Date(res.body.shareLink.createdAt);
    const diffHours = (expiresAt.getTime() - createdAt.getTime()) / 3_600_000;
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('Scenario 3 — returns the existing active link unchanged, not a duplicate', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-existing@example.com');
    const note = await createNoteDirect(userId);
    const existing = await createShareLinkDirect(note.id, { viewCount: 5 });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 1 });

    expect(res.status).toBe(201);
    expect(res.body.shareLink.token).toBe(existing.token);
    expect(res.body.shareLink.viewCount).toBe(5);

    const count = await prisma.shareLink.count({ where: { noteId: note.id } });
    expect(count).toBe(1);
  });

  it('Scenario 4 — replaces an expired existing link with a new one', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-expired@example.com');
    const note = await createNoteDirect(userId);
    const expired = await createShareLinkDirect(note.id, {
      expiresAt: new Date(Date.now() - 1000),
      viewCount: 9,
    });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.shareLink.token).not.toBe(expired.token);
    expect(res.body.shareLink.viewCount).toBe(0);

    const count = await prisma.shareLink.count({ where: { noteId: note.id } });
    expect(count).toBe(1);
  });

  it('Scenario 5 — returns 404 NOTE_NOT_FOUND for a nonexistent note', async () => {
    const { accessToken } = await registerAndLogin('share-gen-missing@example.com');

    const res = await supertest(app)
      .post('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/share')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 5b — returns 404 NOTE_NOT_FOUND for a note owned by another user', async () => {
    const owner = await registerAndLogin('share-gen-owner@example.com');
    const other = await registerAndLogin('share-gen-other@example.com');
    const note = await createNoteDirect(owner.userId);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 5c — returns 404 NOTE_NOT_FOUND for a soft-deleted note', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-deleted@example.com');
    const note = await createNoteDirect(userId, { deletedAt: new Date() });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 6 — returns 422 VALIDATION_ERROR for an expiry below the minimum', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-toolow@example.com');
    const note = await createNoteDirect(userId);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 7 — returns 422 VALIDATION_ERROR for an expiry above the maximum', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-toohigh@example.com');
    const note = await createNoteDirect(userId);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 721 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 8 — returns 422 VALIDATION_ERROR for a non-numeric expiry', async () => {
    const { accessToken, userId } = await registerAndLogin('share-gen-nonnum@example.com');
    const note = await createNoteDirect(userId);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 'soon' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 9 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app)
      .post('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/share')
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/shared/:token', () => {
  it('Scenario 10 — publicly accesses a shared note without authentication', async () => {
    const { userId } = await registerAndLogin('share-public-access@example.com');
    const note = await createNoteDirect(userId, { title: 'Shared Title', content: '<p>Body</p>' });
    const share = await createShareLinkDirect(note.id);

    const res = await supertest(app).get(`/api/shared/${share.token}`);

    expect(res.status).toBe(200);
    expect(res.body.note).toEqual({
      title: 'Shared Title',
      content: '<p>Body</p>',
      authorName: 'Test User',
      createdAt: expect.any(String),
    });
    expect(res.body.note.id).toBeUndefined();
    expect(res.body.note.tags).toBeUndefined();
    expect(res.body.note.viewCount).toBeUndefined();

    const updated = await prisma.shareLink.findUnique({ where: { token: share.token } });
    expect(updated?.viewCount).toBe(1);
  });

  it('Scenario 11 — increments viewCount atomically under concurrent access', async () => {
    const { userId } = await registerAndLogin('share-public-concurrent@example.com');
    const note = await createNoteDirect(userId);
    const share = await createShareLinkDirect(note.id, { viewCount: 5 });

    await Promise.all(
      Array.from({ length: 10 }, () => supertest(app).get(`/api/shared/${share.token}`)),
    );

    const updated = await prisma.shareLink.findUnique({ where: { token: share.token } });
    expect(updated?.viewCount).toBe(15);
  });

  it('Scenario 12 — returns 404 SHARE_LINK_NOT_FOUND for an unknown token', async () => {
    const res = await supertest(app).get('/api/shared/does-not-exist-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHARE_LINK_NOT_FOUND');
  });

  it('Scenario 13 — returns 410 SHARE_LINK_EXPIRED for an expired link, without incrementing viewCount', async () => {
    const { userId } = await registerAndLogin('share-public-expired@example.com');
    const note = await createNoteDirect(userId);
    const share = await createShareLinkDirect(note.id, {
      expiresAt: new Date(Date.now() - 1000),
      viewCount: 3,
    });

    const res = await supertest(app).get(`/api/shared/${share.token}`);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('SHARE_LINK_EXPIRED');

    const updated = await prisma.shareLink.findUnique({ where: { token: share.token } });
    expect(updated?.viewCount).toBe(3);
  });

  it('Scenario 14 — returns 404 SHARE_LINK_NOT_FOUND when the associated note is soft-deleted', async () => {
    const { userId } = await registerAndLogin('share-public-notedeleted@example.com');
    const note = await createNoteDirect(userId);
    const share = await createShareLinkDirect(note.id);
    // Defensive scenario — normally BR-014 hard-deletes the ShareLink on soft delete, so this
    // state is forced directly to exercise the defensive branch in getSharedNote.
    await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } });

    const res = await supertest(app).get(`/api/shared/${share.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHARE_LINK_NOT_FOUND');
  });
});

describe('DELETE /api/notes/:id/share', () => {
  it('Scenario 15 — revokes an active share link', async () => {
    const { accessToken, userId } = await registerAndLogin('share-revoke-happy@example.com');
    const note = await createNoteDirect(userId);
    await createShareLinkDirect(note.id);

    const res = await supertest(app)
      .delete(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toEqual(expect.any(String));

    const remaining = await prisma.shareLink.findUnique({ where: { noteId: note.id } });
    expect(remaining).toBeNull();
  });

  it('Scenario 16 — a revoked link is immediately inaccessible publicly', async () => {
    const { accessToken, userId } = await registerAndLogin('share-revoke-then-access@example.com');
    const note = await createNoteDirect(userId);
    const share = await createShareLinkDirect(note.id);

    await supertest(app)
      .delete(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await supertest(app).get(`/api/shared/${share.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHARE_LINK_NOT_FOUND');
  });

  it('Scenario 17 — returns 404 NOTE_NOT_FOUND for a nonexistent note', async () => {
    const { accessToken } = await registerAndLogin('share-revoke-missing@example.com');

    const res = await supertest(app)
      .delete('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/share')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 17b — returns 404 NOTE_NOT_FOUND for a note owned by another user', async () => {
    const owner = await registerAndLogin('share-revoke-owner@example.com');
    const other = await registerAndLogin('share-revoke-other@example.com');
    const note = await createNoteDirect(owner.userId);
    await createShareLinkDirect(note.id);

    const res = await supertest(app)
      .delete(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 18 — returns 404 SHARE_LINK_NOT_FOUND when the note has no active share link', async () => {
    const { accessToken, userId } = await registerAndLogin('share-revoke-noactive@example.com');
    const note = await createNoteDirect(userId);

    const res = await supertest(app)
      .delete(`/api/notes/${note.id}/share`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHARE_LINK_NOT_FOUND');
  });

  it('Scenario 19 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app).delete(
      '/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/share',
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/shares', () => {
  it('Scenario 20 — lists active share links with full metadata', async () => {
    const { accessToken, userId } = await registerAndLogin('share-list-happy@example.com');
    const noteA = await createNoteDirect(userId, { title: 'Note A' });
    const noteB = await createNoteDirect(userId, { title: 'Note B' });
    await createShareLinkDirect(noteA.id);
    await createShareLinkDirect(noteB.id);

    const res = await supertest(app)
      .get('/api/shares')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shares).toHaveLength(2);
    expect(res.body.shares[0]).toEqual({
      noteId: expect.any(String),
      noteTitle: expect.any(String),
      url: expect.any(String),
      expiresAt: expect.any(String),
      viewCount: 0,
      createdAt: expect.any(String),
    });
  });

  it('Scenario 21 — excludes expired links', async () => {
    const { accessToken, userId } = await registerAndLogin('share-list-expired@example.com');
    const active = await createNoteDirect(userId, { title: 'Active' });
    const expired = await createNoteDirect(userId, { title: 'Expired' });
    await createShareLinkDirect(active.id);
    await createShareLinkDirect(expired.id, { expiresAt: new Date(Date.now() - 1000) });

    const res = await supertest(app)
      .get('/api/shares')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shares).toHaveLength(1);
    expect(res.body.shares[0].noteTitle).toBe('Active');
  });

  it('Scenario 22 — returns an empty list when there are no active share links', async () => {
    const { accessToken } = await registerAndLogin('share-list-empty@example.com');

    const res = await supertest(app)
      .get('/api/shares')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shares).toEqual([]);
  });

  it('Scenario 23 — scopes results to the authenticated user only', async () => {
    const userA = await registerAndLogin('share-list-scope-a@example.com');
    const userB = await registerAndLogin('share-list-scope-b@example.com');
    const noteA = await createNoteDirect(userA.userId, { title: 'A-Only' });
    const noteB = await createNoteDirect(userB.userId, { title: 'B-Only' });
    await createShareLinkDirect(noteA.id);
    await createShareLinkDirect(noteB.id);

    const res = await supertest(app)
      .get('/api/shares')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shares).toHaveLength(1);
    expect(res.body.shares[0].noteTitle).toBe('A-Only');
  });

  it('Scenario 24 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app).get('/api/shares');
    expect(res.status).toBe(401);
  });
});
