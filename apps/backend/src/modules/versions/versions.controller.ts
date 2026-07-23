import type { Request, Response } from 'express';
import type { NoteIdParam, VersionNumberParam } from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import { listVersions, getVersion, restoreVersion } from './versions.service.js';

export async function listVersionsHandler(req: Request<NoteIdParam>, res: Response): Promise<void> {
  const result = await listVersions(prisma, req.userId as string, req.params.id);
  res.status(200).json(result);
}

export async function getVersionHandler(req: Request, res: Response): Promise<void> {
  // `versionNumber` is coerced to a number by validateParams(VersionNumberParamSchema), which
  // conflicts with Express's ParamsDictionary (string-only) constraint on Request<P> — cast
  // rather than type the generic, matching this codebase's `req.body as X` convention.
  const { id, versionNumber } = req.params as unknown as VersionNumberParam;
  const result = await getVersion(prisma, req.userId as string, id, versionNumber);
  res.status(200).json(result);
}

export async function restoreVersionHandler(req: Request, res: Response): Promise<void> {
  const { id, versionNumber } = req.params as unknown as VersionNumberParam;
  const result = await restoreVersion(prisma, req.userId as string, id, versionNumber);
  res.status(200).json(result);
}
