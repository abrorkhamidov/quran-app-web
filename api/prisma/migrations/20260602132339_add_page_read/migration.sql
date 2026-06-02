-- CreateTable
CREATE TABLE "PageRead" (
    "userId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageRead_pkey" PRIMARY KEY ("userId","page")
);

-- CreateIndex
CREATE INDEX "PageRead_userId_idx" ON "PageRead"("userId");
