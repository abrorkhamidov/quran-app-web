-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "goalLevel" TEXT NOT NULL DEFAULT 'egg',
    "goalTargetSeconds" INTEGER NOT NULL DEFAULT 120,
    "preferredReciterId" INTEGER NOT NULL DEFAULT 7,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);
