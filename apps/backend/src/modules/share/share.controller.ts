import type { Request, Response } from 'express';
import type { CreateShareRequest, NoteIdParam, ShareTokenParam } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { generateShareLink, revokeShareLink, listShares, getSharedNote } from './share.service.js';

export async function generateShareLinkHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await generateShareLink(
    prisma,
    req.userId as string,
    req.params.id,
    req.body as CreateShareRequest,
  );
  res.status(201).json(result);
}

export async function revokeShareLinkHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await revokeShareLink(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}

export async function listSharesHandler(req: Request, res: Response): Promise<void> {
  const result = await listShares(prisma, req.userId as string);
  res.status(200).json(result);
}

export async function getSharedNoteHandler(
  req: Request<ShareTokenParam>,
  res: Response,
): Promise<void> {
  const result = await getSharedNote(prisma, req.params.token);
  res.status(200).json(result);
}
