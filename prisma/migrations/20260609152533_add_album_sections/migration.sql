-- CreateEnum
CREATE TYPE "AlbumSectionKind" AS ENUM ('COVER', 'PREFACE', 'FANLI', 'YUANLIU', 'RULES', 'ZIBEI', 'COMPILERS', 'TULU', 'PORTRAITS', 'POSTSCRIPT', 'CUSTOM_TEXT', 'CUSTOM_IMAGE');

-- CreateTable
CREATE TABLE "AlbumSection" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "kind" "AlbumSectionKind" NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "body" TEXT,
    "signature" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumSection_familyId_order_idx" ON "AlbumSection"("familyId", "order");

-- AddForeignKey
ALTER TABLE "AlbumSection" ADD CONSTRAINT "AlbumSection_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
