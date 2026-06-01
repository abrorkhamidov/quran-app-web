-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "versesCount" INTEGER NOT NULL,
    "pagesCount" INTEGER NOT NULL,
    "hasanat" INTEGER NOT NULL,
    "startSurah" INTEGER NOT NULL,
    "startAyah" INTEGER NOT NULL,
    "endSurah" INTEGER NOT NULL,
    "endAyah" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProgress" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "secondsRead" INTEGER NOT NULL DEFAULT 0,
    "versesRead" INTEGER NOT NULL DEFAULT 0,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "hasanat" INTEGER NOT NULL DEFAULT 0,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyProgress_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "Streak" (
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ReadingSession_userId_idx" ON "ReadingSession"("userId");

-- CreateIndex
CREATE INDEX "DailyProgress_userId_idx" ON "DailyProgress"("userId");
