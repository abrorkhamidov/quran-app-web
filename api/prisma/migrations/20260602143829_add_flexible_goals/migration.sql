-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "focusId" INTEGER,
ADD COLUMN     "focusType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "goalTargetAyahs" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "goalType" TEXT NOT NULL DEFAULT 'time';
