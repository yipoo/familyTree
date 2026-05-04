/**
 * 审计日志写入封装。
 *
 * 仅写操作调用：CREATE / UPDATE / DELETE / APPROVE / REJECT。
 * 失败不应阻塞业务路径——所以独立 try/catch、不抛出。
 */
import { prisma } from "@/lib/db";
import type { ChangeKind } from "@/lib/generated/prisma/enums";

export interface AuditEntry {
  familyId: string;
  actorId: string;
  kind: ChangeKind;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        familyId: entry.familyId,
        actorId: entry.actorId,
        kind: entry.kind,
        entity: entry.entity,
        entityId: entry.entityId,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
      },
    });
  } catch (e) {
    console.warn("[audit] write failed", e);
  }
}
