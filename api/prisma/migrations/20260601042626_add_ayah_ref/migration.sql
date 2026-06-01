-- CreateTable
CREATE TABLE "AyahRef" (
    "surah" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "letterCount" INTEGER NOT NULL,

    CONSTRAINT "AyahRef_pkey" PRIMARY KEY ("surah","ayah")
);

-- CreateIndex
CREATE INDEX "AyahRef_page_idx" ON "AyahRef"("page");
