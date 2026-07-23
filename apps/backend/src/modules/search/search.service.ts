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
 * Builds the shared WHERE fragment (user scope, non-deleted, search match, optional tag filter) so
 * the data query and count query stay in lockstep — they must agree on which rows match.
 */
function buildWhereFragment(userId: string, query: SearchQuery): Prisma.Sql {
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
    AND n."searchVector" @@ plainto_tsquery('english', ${query.q})
    ${tagFilter}
  `;
}

export async function searchNotes(
  prisma: PrismaClient,
  userId: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  const { page, pageSize } = query;
  const where = buildWhereFragment(userId, query);
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT
        n."id" AS "id",
        n."title" AS "title",
        ts_rank(n."searchVector", plainto_tsquery('english', ${query.q})) AS "rank",
        ts_headline('english', n."contentPlain", plainto_tsquery('english', ${query.q}),
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
