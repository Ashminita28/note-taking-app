import type { Request, Response } from 'express';
import type { SearchQuery } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { searchNotes } from './search.service.js';

export async function searchNotesHandler(req: Request, res: Response): Promise<void> {
  const result = await searchNotes(prisma, req.userId as string, req.validatedQuery as SearchQuery);
  res.status(200).json(result);
}
