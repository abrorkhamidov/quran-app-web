-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "surah" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surah" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_surah_ayah_key" ON "Favorite"("userId", "surah", "ayah");
