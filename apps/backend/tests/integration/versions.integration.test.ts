import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { purgeOldVersions } from '../../src/modules/versions/versions.service';
import { resetNotesTables, registerAndLogin } from './setup';

const app = createApp();

async function createNoteViaApi(
  accessToken: string,
  body: { title?: string; content?: string } = {},
): Promise<{ id: string }> {
  const res = await supertest(app)
    .post('/api/notes')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);
  return { id: res.body.note.id };
}

async function patchNoteViaApi(
  accessToken: string,
  noteId: string,
  body: { title?: string; content?: string },
): Promise<void> {
  await supertest(app)
    .patch(`/api/notes/${noteId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);
}

async function createVersionDirect(
  noteId: string,
  overrides: { versionNumber: number; title?: string; content?: string; createdAt?: Date },
): Promise<void> {
  await prisma.noteVersion.create({
    data: {
      noteId,
      versionNumber: overrides.versionNumber,
      title: overrides.title ?? 'Untitled',
      content: overrides.content ?? '',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
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

describe('GET /api/notes/:id/versions', () => {
  it('Scenario 1 — lists versions newest-first', async () => {
    const { accessToken } = await registerAndLogin('ver-list-happy@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'V1', content: '<p>one</p>' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V2', content: '<p>two</p>' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V3', content: '<p>three</p>' });

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([
      3, 2, 1,
    ]);
    expect(res.body.versions[0]).toEqual({
      versionNumber: 3,
      title: 'V3',
      contentPreview: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('Scenario 2 — truncates contentPreview to 200 characters', async () => {
    const { accessToken } = await registerAndLogin('ver-list-preview@example.com');
    const longContent = `<p>${'x'.repeat(250)}</p>`;
    const note = await createNoteViaApi(accessToken, { title: 'Long', content: longContent });

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.versions[0].contentPreview).toHaveLength(200);
    expect(res.body.versions[0].content).toBeUndefined();
  });

  it('Scenario 3 — a brand-new note has exactly one version', async () => {
    const { accessToken } = await registerAndLogin('ver-list-single@example.com');
    const note = await createNoteViaApi(accessToken);

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0].versionNumber).toBe(1);
  });

  it('Scenario 4 — returns 404 NOTE_NOT_FOUND for a nonexistent note', async () => {
    const { accessToken } = await registerAndLogin('ver-list-missing@example.com');

    const res = await supertest(app)
      .get('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 5 — returns 404 NOTE_NOT_FOUND for a note owned by another user', async () => {
    const owner = await registerAndLogin('ver-list-owner@example.com');
    const other = await registerAndLogin('ver-list-other@example.com');
    const note = await createNoteViaApi(owner.accessToken);

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 6 — returns 404 NOTE_NOT_FOUND for a soft-deleted note', async () => {
    const { accessToken } = await registerAndLogin('ver-list-deleted@example.com');
    const note = await createNoteViaApi(accessToken);
    await supertest(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 7 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app).get(
      '/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions',
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/notes/:id/versions/:versionNumber', () => {
  it('Scenario 8 — returns the full content of a specific version', async () => {
    const { accessToken } = await registerAndLogin('ver-view-happy@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'Draft', content: '<p>hello</p>' });
    await patchNoteViaApi(accessToken, note.id, { title: 'Final', content: '<p>bye</p>' });

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions/1`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toEqual({
      versionNumber: 1,
      title: 'Draft',
      content: '<p>hello</p>',
      createdAt: expect.any(String),
    });
  });

  it('Scenario 9 — viewing an older version has no side effects', async () => {
    const { accessToken } = await registerAndLogin('ver-view-noeffect@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'V1' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V2' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V3' });

    await supertest(app)
      .get(`/api/notes/${note.id}/versions/1`)
      .set('Authorization', `Bearer ${accessToken}`);

    const currentRes = await supertest(app)
      .get(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(currentRes.body.note.title).toBe('V3');

    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(versions).toHaveLength(3);
  });

  it('Scenario 10 — returns 404 VERSION_NOT_FOUND for an unknown versionNumber', async () => {
    const { accessToken } = await registerAndLogin('ver-view-noversion@example.com');
    const note = await createNoteViaApi(accessToken);

    const res = await supertest(app)
      .get(`/api/notes/${note.id}/versions/99`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VERSION_NOT_FOUND');
  });

  it('Scenario 11 — returns 404 NOTE_NOT_FOUND for a nonexistent/foreign/soft-deleted note', async () => {
    const { accessToken } = await registerAndLogin('ver-view-notefound@example.com');

    const missing = await supertest(app)
      .get('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions/1')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOTE_NOT_FOUND');

    const other = await registerAndLogin('ver-view-other@example.com');
    const foreignNote = await createNoteViaApi(accessToken);
    const foreignRes = await supertest(app)
      .get(`/api/notes/${foreignNote.id}/versions/1`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body.error.code).toBe('NOTE_NOT_FOUND');

    const deletedNote = await createNoteViaApi(accessToken);
    await supertest(app)
      .delete(`/api/notes/${deletedNote.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    const deletedRes = await supertest(app)
      .get(`/api/notes/${deletedNote.id}/versions/1`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deletedRes.status).toBe(404);
    expect(deletedRes.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 12 — returns 422 VALIDATION_ERROR for a non-numeric or non-positive versionNumber', async () => {
    const { accessToken } = await registerAndLogin('ver-view-invalid@example.com');
    const note = await createNoteViaApi(accessToken);

    const nonNumeric = await supertest(app)
      .get(`/api/notes/${note.id}/versions/abc`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonNumeric.status).toBe(422);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    const zero = await supertest(app)
      .get(`/api/notes/${note.id}/versions/0`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(zero.status).toBe(422);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 13 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app).get(
      '/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions/1',
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/notes/:id/versions/:versionNumber/restore', () => {
  it('Scenario 14 — restoring an older version updates the note and creates a new version', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-happy@example.com');
    const note = await createNoteViaApi(accessToken, {
      title: 'Original',
      content: '<p>original</p>',
    });
    await patchNoteViaApi(accessToken, note.id, {
      title: 'Current',
      content: '<p>current</p>',
    });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.note).toMatchObject({ title: 'Original', content: '<p>original</p>' });

    const versions = await prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { versionNumber: 'asc' },
    });
    expect(versions).toHaveLength(3);
    expect(versions[2]).toMatchObject({
      versionNumber: 3,
      title: 'Original',
      content: '<p>original</p>',
    });
    // Version 1's own record is untouched (BR-017).
    expect(versions[0]).toMatchObject({ versionNumber: 1, title: 'Original' });
  });

  it('Scenario 15 — the restoration appears as the latest version; prior versions remain accessible', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-history@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'V1' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V2' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V3' });

    await supertest(app)
      .post(`/api/notes/${note.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    const listRes = await supertest(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.body.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([
      4, 3, 2, 1,
    ]);

    for (const versionNumber of [1, 2, 3]) {
      const viewRes = await supertest(app)
        .get(`/api/notes/${note.id}/versions/${versionNumber}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(viewRes.status).toBe(200);
    }
  });

  it('Scenario 16 — restoring the current latest version still creates a new version', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-latest@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'V1' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V2' });
    await patchNoteViaApi(accessToken, note.id, { title: 'V3' });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/versions/3/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('V3');
    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(versions).toHaveLength(4);
  });

  it('Scenario 17 — restore recomputes contentPlain from the restored content', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-contentplain@example.com');
    const note = await createNoteViaApi(accessToken, {
      title: 'Original',
      content: '<p>original text</p>',
    });
    await patchNoteViaApi(accessToken, note.id, {
      title: 'Current',
      content: '<p>current text</p>',
    });

    await supertest(app)
      .post(`/api/notes/${note.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    const updated = await prisma.note.findUnique({ where: { id: note.id } });
    expect(updated?.contentPlain).toBe('original text');
  });

  it('Scenario 18 — returns 404 VERSION_NOT_FOUND for an unknown versionNumber, without mutating the note', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-noversion@example.com');
    const note = await createNoteViaApi(accessToken, { title: 'Original' });

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/versions/99/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VERSION_NOT_FOUND');

    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(versions).toHaveLength(1);
    const current = await prisma.note.findUnique({ where: { id: note.id } });
    expect(current?.title).toBe('Original');
  });

  it('Scenario 19 — returns 404 NOTE_NOT_FOUND for a nonexistent or foreign note', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-notefound@example.com');
    const other = await registerAndLogin('ver-restore-other@example.com');

    const missing = await supertest(app)
      .post('/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions/1/restore')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOTE_NOT_FOUND');

    const foreignNote = await createNoteViaApi(accessToken);
    const foreignRes = await supertest(app)
      .post(`/api/notes/${foreignNote.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 20 — returns 404 NOTE_NOT_FOUND for a soft-deleted note', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-deleted@example.com');
    const note = await createNoteViaApi(accessToken);
    await supertest(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('Scenario 21 — returns 422 VALIDATION_ERROR for a non-numeric versionNumber', async () => {
    const { accessToken } = await registerAndLogin('ver-restore-invalid@example.com');
    const note = await createNoteViaApi(accessToken);

    const res = await supertest(app)
      .post(`/api/notes/${note.id}/versions/abc/restore`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 22 — returns 401 when unauthenticated', async () => {
    const res = await supertest(app).post(
      '/api/notes/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e/versions/1/restore',
    );
    expect(res.status).toBe(401);
  });
});

describe('purgeOldVersions (FR-VER-005 auto-purge, no HTTP route)', () => {
  it('Scenario 23 — retains the 10 most recent versions, deletes older-than-90-days versions beyond that', async () => {
    const { userId } = await registerAndLogin('ver-purge-mixed@example.com');
    const note = await prisma.note.create({ data: { userId, title: 'Purge Me' } });
    const now = Date.now();
    // 15 versions: 1-8 are >90 days old, 9-15 are recent.
    for (let n = 1; n <= 15; n += 1) {
      const ageDays = n <= 8 ? 100 : 5;
      await createVersionDirect(note.id, {
        versionNumber: n,
        createdAt: new Date(now - ageDays * 86_400_000),
      });
    }

    const deleted = await purgeOldVersions(prisma);

    expect(deleted).toBe(5);
    const remaining = await prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { versionNumber: 'asc' },
    });
    expect(remaining.map((v) => v.versionNumber)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('Scenario 24 — retains all versions when fewer than 10 exist, even if all are old', async () => {
    const { userId } = await registerAndLogin('ver-purge-few@example.com');
    const note = await prisma.note.create({ data: { userId, title: 'Few Versions' } });
    for (let n = 1; n <= 6; n += 1) {
      await createVersionDirect(note.id, {
        versionNumber: n,
        createdAt: new Date(Date.now() - 100 * 86_400_000),
      });
    }

    await purgeOldVersions(prisma);

    const remaining = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(remaining).toHaveLength(6);
  });

  it('Scenario 25 — retains all versions when none are older than 90 days', async () => {
    const { userId } = await registerAndLogin('ver-purge-recent@example.com');
    const note = await prisma.note.create({ data: { userId, title: 'Recent Versions' } });
    for (let n = 1; n <= 12; n += 1) {
      await createVersionDirect(note.id, {
        versionNumber: n,
        createdAt: new Date(Date.now() - 5 * 86_400_000),
      });
    }

    await purgeOldVersions(prisma);

    const remaining = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(remaining).toHaveLength(12);
  });

  it('Scenario 26 — purge is scoped per note, not globally', async () => {
    const { userId } = await registerAndLogin('ver-purge-isolation@example.com');
    const noteMany = await prisma.note.create({ data: { userId, title: 'Many Old Versions' } });
    const noteFew = await prisma.note.create({ data: { userId, title: 'Few Old Versions' } });

    for (let n = 1; n <= 15; n += 1) {
      const ageDays = n <= 8 ? 100 : 5;
      await createVersionDirect(noteMany.id, {
        versionNumber: n,
        createdAt: new Date(Date.now() - ageDays * 86_400_000),
      });
    }
    for (let n = 1; n <= 3; n += 1) {
      await createVersionDirect(noteFew.id, {
        versionNumber: n,
        createdAt: new Date(Date.now() - 100 * 86_400_000),
      });
    }

    await purgeOldVersions(prisma);

    const remainingMany = await prisma.noteVersion.findMany({ where: { noteId: noteMany.id } });
    const remainingFew = await prisma.noteVersion.findMany({ where: { noteId: noteFew.id } });
    expect(remainingMany).toHaveLength(10);
    expect(remainingFew).toHaveLength(3);
  });
});
