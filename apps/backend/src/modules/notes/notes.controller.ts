import type { Request, Response } from 'express';
import type { CreateNoteRequest, UpdateNoteRequest, NoteIdParam, ListNotesQuery } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import {
  createNote,
  getNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  listNotes,
} from './notes.service.js';

export async function listNotesHandler(req: Request, res: Response): Promise<void> {
  const result = await listNotes(prisma, req.userId as string, req.validatedQuery as ListNotesQuery);
  res.status(200).json(result);
}

export async function createNoteHandler(req: Request, res: Response): Promise<void> {
  const note = await createNote(prisma, req.userId as string, req.body as CreateNoteRequest);
  res.status(201).json({ note });
}

export async function getNoteHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const note = await getNote(prisma, req.userId as string, req.params.id);
  res.status(200).json({ note });
}

export async function updateNoteHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const note = await updateNote(
    prisma,
    req.userId as string,
    req.params.id,
    req.body as UpdateNoteRequest,
  );
  res.status(200).json({ note });
}

export async function deleteNoteHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await softDeleteNote(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}

export async function restoreNoteHandler(
  req: Request<NoteIdParam>,
  res: Response,
): Promise<void> {
  const result = await restoreNote(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}
