import { prisma } from '../../src/config/prisma';
import { signAccessToken } from '../../src/modules/auth/auth.tokens';

/**
 * Creates a user directly via Prisma and signs its access token in-process — most integration
 * suites exercise a specific feature's endpoints, not the login flow (AB-1002's concern), and going
 * through the real register/login HTTP endpoints for every test user would run the global rate
 * limiter dry well before a suite finishes.
 */
export async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  const user = await prisma.user.create({
    data: { name: 'Test User', email, passwordHash: 'unused-in-integration-tests' },
  });
  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  return { accessToken, userId: user.id };
}

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
