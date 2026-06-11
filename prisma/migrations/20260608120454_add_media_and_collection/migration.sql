-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'DOCUMENT', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CollectMode" AS ENUM ('PERSON_UPDATE', 'ADD_CHILD');

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "personId" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'PHOTO',
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "name" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionLink" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "mode" "CollectMode" NOT NULL DEFAULT 'PERSON_UPDATE',
    "note" TEXT,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_familyId_createdAt_idx" ON "Media"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "Media_personId_idx" ON "Media"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionLink_token_key" ON "CollectionLink"("token");

-- CreateIndex
CREATE INDEX "CollectionLink_familyId_createdAt_idx" ON "CollectionLink"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionLink_personId_idx" ON "CollectionLink"("personId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionLink" ADD CONSTRAINT "CollectionLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionLink" ADD CONSTRAINT "CollectionLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
