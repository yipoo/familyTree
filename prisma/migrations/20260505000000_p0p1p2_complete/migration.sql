-- P0/P1/P2 上线就绪批量迁移
--   1. Family.isPublic 字段（P2 /discover 用）
--   2. Family 软删 / 公开 的索引（家族列表过滤 / 发现页查询）
--   3. PdfJob 表 + 枚举（P0 PDF 异步化）
--   4. 高频查询索引补强：Person(name) 等

-- ============================================================
-- 1. Family 加 isPublic + 索引
-- ============================================================
ALTER TABLE "Family" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Family_deletedAt_idx" ON "Family"("deletedAt");
CREATE INDEX "Family_isPublic_idx" ON "Family"("isPublic");

-- ============================================================
-- 2. PdfJob 表
-- ============================================================
CREATE TYPE "PdfJobType" AS ENUM ('LINEAGE_CHART', 'ALBUM');
CREATE TYPE "PdfJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELED');

CREATE TABLE "PdfJob" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "type" "PdfJobType" NOT NULL,
    "status" "PdfJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "outputBytes" BYTEA,
    "outputName" TEXT,
    "error" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PdfJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PdfJob_familyId_createdAt_idx" ON "PdfJob"("familyId", "createdAt");
CREATE INDEX "PdfJob_status_idx" ON "PdfJob"("status");

ALTER TABLE "PdfJob" ADD CONSTRAINT "PdfJob_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
