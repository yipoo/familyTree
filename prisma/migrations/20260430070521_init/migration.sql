-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LifeStatus" AS ENUM ('ALIVE', 'DECEASED', 'LOST', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MarriageType" AS ENUM ('PRIMARY', 'SECONDARY', 'CONCUBINE', 'UXORILOCAL');

-- CreateEnum
CREATE TYPE "ParentRelation" AS ENUM ('BIOLOGICAL', 'ADOPTED', 'FOSTER', 'STEP');

-- CreateEnum
CREATE TYPE "MigrationScope" AS ENUM ('BRANCH', 'PERSON');

-- CreateEnum
CREATE TYPE "ChangeKind" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founderName" TEXT,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL,
    "personId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationName" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "character" TEXT NOT NULL,

    CONSTRAINT "GenerationName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "surnameOnly" BOOLEAN NOT NULL DEFAULT false,
    "gender" "Gender" NOT NULL,
    "generation" INTEGER NOT NULL,
    "generationChar" TEXT,
    "birthYear" INTEGER,
    "deathYear" INTEGER,
    "birthDate" TEXT,
    "deathDate" TEXT,
    "status" "LifeStatus" NOT NULL DEFAULT 'ALIVE',
    "avatarUrl" TEXT,
    "note" TEXT,
    "isMarriedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marriage" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "husbandId" TEXT NOT NULL,
    "wifeId" TEXT NOT NULL,
    "type" "MarriageType" NOT NULL DEFAULT 'PRIMARY',
    "order" INTEGER NOT NULL DEFAULT 1,
    "marriedYear" INTEGER,
    "endedYear" INTEGER,
    "endedReason" TEXT,
    "note" TEXT,

    CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentChild" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "relation" "ParentRelation" NOT NULL DEFAULT 'BIOLOGICAL',
    "birthOrder" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParentChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPersonId" TEXT NOT NULL,
    "locationId" TEXT,
    "description" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "county" TEXT,
    "town" TEXT,
    "village" TEXT,
    "detail" TEXT,
    "fullText" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonLocation" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "scope" "MigrationScope" NOT NULL,
    "branchId" TEXT,
    "personId" TEXT,
    "year" INTEGER,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "reason" TEXT,
    "note" TEXT,

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingSubmission" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PendingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_userId_familyId_key" ON "FamilyMember"("userId", "familyId");

-- CreateIndex
CREATE INDEX "GenerationName_familyId_idx" ON "GenerationName"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationName_familyId_generation_key" ON "GenerationName"("familyId", "generation");

-- CreateIndex
CREATE INDEX "Person_familyId_generation_idx" ON "Person"("familyId", "generation");

-- CreateIndex
CREATE INDEX "Person_familyId_branchId_idx" ON "Person"("familyId", "branchId");

-- CreateIndex
CREATE INDEX "Person_familyId_name_idx" ON "Person"("familyId", "name");

-- CreateIndex
CREATE INDEX "Marriage_familyId_husbandId_idx" ON "Marriage"("familyId", "husbandId");

-- CreateIndex
CREATE INDEX "Marriage_familyId_wifeId_idx" ON "Marriage"("familyId", "wifeId");

-- CreateIndex
CREATE INDEX "ParentChild_familyId_parentId_idx" ON "ParentChild"("familyId", "parentId");

-- CreateIndex
CREATE INDEX "ParentChild_familyId_childId_idx" ON "ParentChild"("familyId", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChild_parentId_childId_relation_key" ON "ParentChild"("parentId", "childId", "relation");

-- CreateIndex
CREATE INDEX "Branch_familyId_idx" ON "Branch"("familyId");

-- CreateIndex
CREATE INDEX "PersonLocation_personId_idx" ON "PersonLocation"("personId");

-- CreateIndex
CREATE INDEX "PersonLocation_locationId_idx" ON "PersonLocation"("locationId");

-- CreateIndex
CREATE INDEX "Migration_familyId_branchId_idx" ON "Migration"("familyId", "branchId");

-- CreateIndex
CREATE INDEX "Migration_familyId_personId_idx" ON "Migration"("familyId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_familyId_idx" ON "ShareLink"("familyId");

-- CreateIndex
CREATE INDEX "AuditLog_familyId_createdAt_idx" ON "AuditLog"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingSubmission_familyId_status_idx" ON "PendingSubmission"("familyId", "status");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationName" ADD CONSTRAINT "GenerationName_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_husbandId_fkey" FOREIGN KEY ("husbandId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_wifeId_fkey" FOREIGN KEY ("wifeId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_rootPersonId_fkey" FOREIGN KEY ("rootPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonLocation" ADD CONSTRAINT "PersonLocation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonLocation" ADD CONSTRAINT "PersonLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubmission" ADD CONSTRAINT "PendingSubmission_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
