import { prisma } from '../../src/config/prisma';

/** Truncates auth-related tables so integration tests run isolated against the real test DB. */
export async function resetAuthTables(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetOtp.deleteMany();
  await prisma.user.deleteMany();
}

/** Truncates notes-related tables (FK-safe order) so integration tests run isolated against the real test DB. */
export async function resetNotesTables(): Promise<void> {
  await prisma.shareLink.deleteMany();
  await prisma.noteVersion.deleteMany();
  await prisma.noteTag.deleteMany();
  await prisma.note.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
