import { prisma } from '../../src/config/prisma';

/** Truncates auth-related tables so integration tests run isolated against the real test DB. */
export async function resetAuthTables(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetOtp.deleteMany();
  await prisma.user.deleteMany();
}
