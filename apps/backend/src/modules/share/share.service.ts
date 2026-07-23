import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  CreateShareRequest,
  CreateShareResponse,
  RevokeShareResponse,
  ListSharesResponse,
  GetSharedNoteResponse,
  ShareLink,
} from '@note-app/shared';
import { config } from '../../config/env.js';
import { NoteNotFoundError } from '../notes/notes.errors.js';
import { ShareLinkNotFoundError, ShareLinkExpiredError } from './share.errors.js';

function buildUrl(token: string): string {
  return `${config.FRONTEND_URL}/shared/${token}`;
}

function toShareLink(record: {
  token: string;
  expiresAt: Date;
  viewCount: number;
  createdAt: Date;
}): ShareLink {
  return {
    token: record.token,
    url: buildUrl(record.token),
    expiresAt: record.expiresAt.toISOString(),
    viewCount: record.viewCount,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function generateShareLink(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
  input: CreateShareRequest,
): Promise<CreateShareResponse> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!note) {
    throw new NoteNotFoundError();
  }

  const expiresInHours = input.expiresInHours ?? config.SHARE_DEFAULT_EXPIRY_HRS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 3_600_000);

  const existing = await prisma.shareLink.findUnique({ where: { noteId } });

  // BR-006: at most one active link per note. An existing non-expired link is returned as-is
  // (FRS AF-1); an existing but expired link is regenerated in place (Scenario 4).
  if (existing && existing.expiresAt > now) {
    return { shareLink: toShareLink(existing) };
  }

  const shareLink = existing
    ? await prisma.shareLink.update({
        where: { noteId },
        data: { token: randomUUID(), expiresAt, viewCount: 0, createdAt: now },
      })
    : await prisma.shareLink.create({
        data: { noteId, token: randomUUID(), expiresAt, viewCount: 0 },
      });

  return { shareLink: toShareLink(shareLink) };
}

export async function revokeShareLink(
  prisma: PrismaClient,
  userId: string,
  noteId: string,
): Promise<RevokeShareResponse> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) {
    throw new NoteNotFoundError();
  }

  const existing = await prisma.shareLink.findUnique({ where: { noteId } });
  if (!existing) {
    throw new ShareLinkNotFoundError();
  }

  await prisma.shareLink.delete({ where: { noteId } });

  return { message: 'Share link revoked successfully.' };
}

export async function listShares(prisma: PrismaClient, userId: string): Promise<ListSharesResponse> {
  const shares = await prisma.shareLink.findMany({
    where: { expiresAt: { gt: new Date() }, note: { userId } },
    include: { note: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    shares: shares.map((share) => ({
      noteId: share.note.id,
      noteTitle: share.note.title,
      url: buildUrl(share.token),
      expiresAt: share.expiresAt.toISOString(),
      viewCount: share.viewCount,
      createdAt: share.createdAt.toISOString(),
    })),
  };
}

export async function getSharedNote(prisma: PrismaClient, token: string): Promise<GetSharedNoteResponse> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { note: { include: { user: true } } },
  });

  if (!shareLink) {
    throw new ShareLinkNotFoundError();
  }
  if (shareLink.expiresAt <= new Date()) {
    throw new ShareLinkExpiredError();
  }
  // Defensive: BR-014 hard-deletes the ShareLink synchronously with soft delete, so this
  // branch should be unreachable in practice (Scenario 14).
  if (shareLink.note.deletedAt !== null) {
    throw new ShareLinkNotFoundError();
  }

  // Atomic increment (SDS §25.3 / BR-020) via Prisma's native `increment`, not raw SQL — a single
  // atomic UPDATE, same guarantee as the SQL in SDS, without violating the backend's
  // no-raw-SQL-except-search constraint.
  await prisma.shareLink.updateMany({
    where: { token, expiresAt: { gt: new Date() } },
    data: { viewCount: { increment: 1 } },
  });

  return {
    note: {
      title: shareLink.note.title,
      content: shareLink.note.content,
      authorName: shareLink.note.user.name,
      createdAt: shareLink.note.createdAt.toISOString(),
    },
  };
}
