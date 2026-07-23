import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { resetNotesTables, registerAndLogin } from './setup';

const app = createApp();

async function createTag(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { userId, name } });
  return tag.id;
}

/**
 * Creates a note directly via Prisma with an explicit `contentPlain`, so the AB-1004 trigger
 * (`note_search_vector_update`, fires on INSERT/UPDATE of `title`/`contentPlain`) populates a
 * realistic `searchVector` without going through the slower real `POST /api/notes` HTTP path.
 */
async function createSearchableNoteDirect(
  userId: string,
  overrides: {
    title?: string;
    contentPlain?: string;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  } = {},
): Promise<{ id: string }> {
  return prisma.note.create({
    data: {
      userId,
      title: overrides.title ?? 'Untitled',
      contentPlain: overrides.contentPlain ?? '',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
      ...(overrides.deletedAt !== undefined ? { deletedAt: overrides.deletedAt } : {}),
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

describe('GET /api/search', () => {
  it('Scenario 1 — finds a note by a title match, with a highlighted snippet and a positive rank', async () => {
    const { accessToken, userId } = await registerAndLogin('search-title-match@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Weekly Standup Notes',
      contentPlain: 'Discussed sprint progress.',
    });

    const res = await supertest(app)
      .get('/api/search?q=standup')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Weekly Standup Notes');
    expect(res.body.data[0].rank).toBeGreaterThan(0);
  });

  it('Scenario 2 — finds a note by a content-only match, snippet highlights the matched term', async () => {
    const { accessToken, userId } = await registerAndLogin('search-content-match@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Infra Meeting',
      contentPlain: 'We discussed migrating workloads to kubernetes next quarter.',
    });

    const res = await supertest(app)
      .get('/api/search?q=kubernetes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].snippet).toContain('<mark>');
    expect(res.body.data[0].snippet.toLowerCase()).toContain('kubernetes');
  });

  it('Scenario 3 — stemming matches "running" when searching "run"', async () => {
    const { accessToken, userId } = await registerAndLogin('search-stemming@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Morning Routine',
      contentPlain: 'Went running before work today.',
    });

    const res = await supertest(app)
      .get('/api/search?q=run')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Morning Routine');
  });

  it('Scenario 4 — a title match outranks a content-only match for the same term', async () => {
    const { accessToken, userId } = await registerAndLogin('search-ranking@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Meeting Notes',
      contentPlain: 'We briefly touched on the budget.',
    });
    await createSearchableNoteDirect(userId, {
      title: 'Budget Report',
      contentPlain: 'Quarterly figures attached.',
    });

    const res = await supertest(app)
      .get('/api/search?q=budget')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('Budget Report');
    expect(res.body.data[0].rank).toBeGreaterThan(res.body.data[1].rank);
  });

  it('Scenario 5 — returns an empty page (not an error) when nothing matches', async () => {
    const { accessToken, userId } = await registerAndLogin('search-no-results@example.com');
    await createSearchableNoteDirect(userId, { title: 'Groceries', contentPlain: 'Milk, eggs.' });

    const res = await supertest(app)
      .get('/api/search?q=nonexistentterm12345')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('Scenario 6 — combines search with a tag filter using AND logic', async () => {
    const { accessToken, userId } = await registerAndLogin('search-tag-filter@example.com');
    const workTagId = await createTag(userId, 'Work');
    const personalTagId = await createTag(userId, 'Personal');
    const workNote = await createSearchableNoteDirect(userId, {
      title: 'Work Budget',
      contentPlain: 'Team budget planning.',
    });
    const personalNote = await createSearchableNoteDirect(userId, {
      title: 'Personal Budget',
      contentPlain: 'Household budget planning.',
    });
    await prisma.noteTag.create({ data: { noteId: workNote.id, tagId: workTagId } });
    await prisma.noteTag.create({ data: { noteId: personalNote.id, tagId: personalTagId } });

    const res = await supertest(app)
      .get(`/api/search?q=budget&tagIds=${workTagId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Work Budget');
  });

  it('Scenario 7 — paginates matching results, ranked consistently across pages', async () => {
    const { accessToken, userId } = await registerAndLogin('search-pagination@example.com');
    for (let i = 0; i < 25; i += 1) {
      await createSearchableNoteDirect(userId, {
        title: `Widget Note ${i}`,
        contentPlain: 'A note about widgets.',
      });
    }

    const page1 = await supertest(app)
      .get('/api/search?q=widget&page=1&pageSize=20')
      .set('Authorization', `Bearer ${accessToken}`);
    const page2 = await supertest(app)
      .get('/api/search?q=widget&page=2&pageSize=20')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 });

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.pagination).toEqual({ page: 2, pageSize: 20, totalItems: 25, totalPages: 2 });

    const page1Ids = new Set(page1.body.data.map((n: { id: string }) => n.id));
    const page2Ids = new Set(page2.body.data.map((n: { id: string }) => n.id));
    expect([...page1Ids].some((id) => page2Ids.has(id))).toBe(false);
  });

  it('Scenario 8 — excludes soft-deleted notes from results', async () => {
    const { accessToken, userId } = await registerAndLogin('search-soft-deleted@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Trashed Note',
      contentPlain: 'Mentions archive-only-term.',
      deletedAt: new Date(),
    });

    const res = await supertest(app)
      .get('/api/search?q=archive-only-term')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('Scenario 9 — scopes results to the authenticated user only', async () => {
    const { accessToken, userId } = await registerAndLogin('search-scope-a@example.com');
    const { userId: otherUserId } = await registerAndLogin('search-scope-b@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'My Roadmap',
      contentPlain: 'roadmap details',
    });
    await createSearchableNoteDirect(otherUserId, {
      title: 'Their Roadmap',
      contentPlain: 'roadmap details',
    });

    const res = await supertest(app)
      .get('/api/search?q=roadmap')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('My Roadmap');
  });

  it('Scenario 10 — returns 422 VALIDATION_ERROR when q is missing', async () => {
    const { accessToken } = await registerAndLogin('search-missing-q@example.com');

    const res = await supertest(app).get('/api/search').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 10b — returns 422 VALIDATION_ERROR when q is empty', async () => {
    const { accessToken } = await registerAndLogin('search-empty-q@example.com');

    const res = await supertest(app)
      .get('/api/search?q=')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 11 — returns 422 VALIDATION_ERROR when q exceeds 200 characters', async () => {
    const { accessToken } = await registerAndLogin('search-q-too-long@example.com');

    const res = await supertest(app)
      .get(`/api/search?q=${'a'.repeat(201)}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 12 — returns 422 VALIDATION_ERROR when q is whitespace-only', async () => {
    const { accessToken } = await registerAndLogin('search-q-whitespace@example.com');

    const res = await supertest(app)
      .get('/api/search?q=%20%20%20')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['page=0', 'page'],
    ['page=-1', 'page'],
    ['page=abc', 'page'],
    ['pageSize=0', 'pageSize'],
    ['pageSize=101', 'pageSize'],
  ])('Scenario 13 — returns 422 VALIDATION_ERROR for %s', async (queryString, field) => {
    const emailSlug = queryString.replace(/[^a-zA-Z0-9]/g, '-');
    const { accessToken } = await registerAndLogin(`search-invalid-${field}-${emailSlug}@example.com`);

    const res = await supertest(app)
      .get(`/api/search?q=term&${queryString}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe(field);
  });

  it('Scenario 14 — returns 422 VALIDATION_ERROR for a malformed tagIds entry', async () => {
    const { accessToken } = await registerAndLogin('search-invalid-tagids@example.com');

    const res = await supertest(app)
      .get('/api/search?q=term&tagIds=not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Scenario 15 — special tsquery-operator characters in q do not cause a 500', async () => {
    const { accessToken, userId } = await registerAndLogin('search-special-chars@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Hello World',
      contentPlain: 'A greeting note.',
    });

    const res = await supertest(app)
      .get(`/api/search?${new URLSearchParams({ q: 'hello & world | test : ! nope' }).toString()}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('Scenario 16 — returns 401 with no Authorization header', async () => {
    const res = await supertest(app).get('/api/search?q=term');

    expect(res.status).toBe(401);
  });

  it('Scenario 17 — prefix matching: "kube" matches a note containing "kubernetes"', async () => {
    const { accessToken, userId } = await registerAndLogin('search-prefix-match@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Infra Notes',
      contentPlain: 'We are migrating workloads to kubernetes next quarter.',
    });

    const res = await supertest(app)
      .get('/api/search?q=kube')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Infra Notes');
  });

  it('Scenario 17b — prefix matching does not match unrelated terms', async () => {
    const { accessToken, userId } = await registerAndLogin('search-prefix-no-match@example.com');
    await createSearchableNoteDirect(userId, {
      title: 'Groceries',
      contentPlain: 'Milk, eggs, bread.',
    });

    const res = await supertest(app)
      .get('/api/search?q=kube')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('confirms the full create-then-search round trip through the real POST /api/notes endpoint', async () => {
    const { accessToken } = await registerAndLogin('search-round-trip@example.com');

    const created = await supertest(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Onboarding Checklist', content: '<p>Steps for new hires.</p>' });
    expect(created.status).toBe(201);

    const res = await supertest(app)
      .get('/api/search?q=onboarding')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(created.body.note.id);
  });
});
