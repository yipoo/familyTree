-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPERADMIN', 'USER');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "alias" TEXT,
ADD COLUMN     "biography" TEXT,
ADD COLUMN     "birthOrder" INTEGER,
ADD COLUMN     "birthPlace" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "noteHint" TEXT,
ADD COLUMN     "paperRecord" TEXT,
ADD COLUMN     "residenceId" TEXT,
ADD COLUMN     "succession" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "SubtreeAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "rootPersonId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "SubtreeAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubtreeAdmin_familyId_userId_idx" ON "SubtreeAdmin"("familyId", "userId");

-- CreateIndex
CREATE INDEX "SubtreeAdmin_rootPersonId_idx" ON "SubtreeAdmin"("rootPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SubtreeAdmin_userId_rootPersonId_key" ON "SubtreeAdmin"("userId", "rootPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_familyId_externalId_key" ON "Person"("familyId", "externalId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtreeAdmin" ADD CONSTRAINT "SubtreeAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtreeAdmin" ADD CONSTRAINT "SubtreeAdmin_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtreeAdmin" ADD CONSTRAINT "SubtreeAdmin_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtreeAdmin" ADD CONSTRAINT "SubtreeAdmin_rootPersonId_fkey" FOREIGN KEY ("rootPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
