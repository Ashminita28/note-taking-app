/*
  Warnings:

  - You are about to drop the column `searchVector` on the `Note` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_note_search_vector";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "PasswordResetOtp" ADD COLUMN     "resetTokenUsed" BOOLEAN NOT NULL DEFAULT false;
