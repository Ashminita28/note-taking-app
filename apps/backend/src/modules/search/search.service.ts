import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { SearchQuery, SearchResponse } from '@note-app/shared';

interface SearchRow {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CountRow {
  count: bigint;
}

/**
 * Converts a raw search query into a `to_tsquery`-safe prefix query (each term becomes `term:*`,
 * ANDed together) so partial input like "kube" matches "kubernetes" (FRS §9.5 AC-6 / SDS §24.5).
 * Unlike `plainto_tsquery`, `to_tsquery` raises a syntax error on stray operator characters
 * (`& | : ! ( )`), so every term is stripped down to letters/digits before being reassembled —
 * this also keeps Scenario 15 (operator characters in `q`) returning 200, not 500.
 * Returns null when no term survives sanitization (e.g. `q` is only punctuation); the caller
 * binds that as a SQL NULL, which makes `searchVector @@ to_tsquery(...)` evaluate to NULL
 * (no rows), so the query still degrades to an empty result set instead of erroring.
 */
function buildPrefixTsQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((term) => term.length > 0);

  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(' & ') : null;
}

/**
 * Builds the shared WHERE fragment (user scope, non-deleted, search match, optional tag filter) so
 * the data query and count query stay in lockstep — they must agree on which rows match.
 */
function buildWhereFragment(
  userId: string,
  query: SearchQuery,
  tsQueryString: string | null,
): Prisma.Sql {
  const tagFilter =
    query.tagIds && query.tagIds.length > 0
      ? Prisma.sql`AND n."id" IN (
          SELECT "noteId" FROM "NoteTag"
          WHERE "tagId"::text IN (${Prisma.join(query.tagIds)})
          GROUP BY "noteId"
          HAVING COUNT(DISTINCT "tagId") = ${query.tagIds.length}
        )`
      : Prisma.empty;

  return Prisma.sql`
    n."userId" = ${userId}::uuid
    AND n."deletedAt" IS NULL
    AND n."searchVector" @@ to_tsquery('english', ${tsQueryString})
    ${tagFilter}
  `;
}

export async function searchNotes(
  prisma: PrismaClient,
  userId: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  const { page, pageSize } = query;
  const tsQueryString = buildPrefixTsQuery(query.q);
  const where = buildWhereFragment(userId, query, tsQueryString);
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT
        n."id" AS "id",
        n."title" AS "title",
        ts_rank(n."searchVector", to_tsquery('english', ${tsQueryString})) AS "rank",
        ts_headline('english', n."contentPlain", to_tsquery('english', ${tsQueryString}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
        ) AS "snippet",
        n."createdAt" AS "createdAt",
        n."updatedAt" AS "updatedAt"
      FROM "Note" n
      WHERE ${where}
      ORDER BY "rank" DESC, n."id" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "Note" n
      WHERE ${where}
    `,
  ]);

  const totalItems = Number(countRows[0]?.count ?? 0n);

  return {
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      rank: row.rank,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    },
  };
}
