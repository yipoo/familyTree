/**
 * 操作撤回（Undo）。
 *
 * 基于 AuditLog 的 before / after 字段，支持以下类型在 24 小时内撤回：
 *   - Person       CREATE / UPDATE / DELETE
 *   - Marriage     CREATE / UPDATE / DELETE
 *   - ParentChild  CREATE / UPDATE / DELETE
 *   - Migration    CREATE / UPDATE / DELETE
 *   - Branch       CREATE / UPDATE / DELETE
 *   - Family       UPDATE / DELETE（不支持 CREATE 撤回——很少需要，且会导致 cascade 问题）
 *
 * 不支持：
 *   - ImportXlsx：批量导入太复杂，无单条 before
 *   - PendingSubmission（APPROVE / REJECT）
 *   - GenerationName / SubtreeAdmin 等其他实体
 *   - PdfJob：PDF 任务不需要撤回
 *
 * 撤回操作本身也写一条 AuditLog（kind=UPDATE / CREATE / DELETE，entity 不变，
 * note 字段加 "[undo of <auditId>]"）。
 */
import { prisma } from "@/lib/db";

export interface UndoResult {
  ok: true;
  auditId: string;
  message: string;
}

export interface UndoError {
  ok: false;
  code:
    | "NOT_FOUND"
    | "TOO_OLD"
    | "UNSUPPORTED"
    | "ALREADY_REVERTED"
    | "STATE_CONFLICT";
  message: string;
}

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

const SUPPORTED_ENTITIES = new Set([
  "Person",
  "Marriage",
  "ParentChild",
  "Migration",
  "Branch",
  "Family",
]);

export interface UndoInput {
  familyId: string;
  auditId: string;
  actorId: string;
}

export async function undoAudit(input: UndoInput): Promise<UndoResult | UndoError> {
  const audit = await prisma.auditLog.findFirst({
    where: { id: input.auditId, familyId: input.familyId },
  });
  if (!audit) {
    return { ok: false, code: "NOT_FOUND", message: "审计记录不存在" };
  }

  const ageMs = Date.now() - audit.createdAt.getTime();
  if (ageMs > UNDO_WINDOW_MS) {
    return {
      ok: false,
      code: "TOO_OLD",
      message: `仅可撤回 24 小时内的操作（此条 ${Math.floor(ageMs / 3600_000)} 小时前）`,
    };
  }

  if (!SUPPORTED_ENTITIES.has(audit.entity)) {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: `不支持撤回 ${audit.entity} 的操作`,
    };
  }
  if (audit.kind !== "CREATE" && audit.kind !== "UPDATE" && audit.kind !== "DELETE") {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: `不支持撤回 ${audit.kind} 操作`,
    };
  }

  // 是否已被撤回过：找同 entity / entityId 上比此条更晚的 audit；若存在 note 含 [undo of audit.id] 则跳
  const later = await prisma.auditLog.findFirst({
    where: {
      familyId: input.familyId,
      entity: audit.entity,
      entityId: audit.entityId,
      createdAt: { gt: audit.createdAt },
    },
    select: { id: true, after: true },
  });
  // 简单防双撤回：要求"自此 audit 之后没有其它写入" —— 否则状态可能已变化
  if (later) {
    return {
      ok: false,
      code: "STATE_CONFLICT",
      message: "该记录在此操作之后又被改动过，无法自动撤回",
    };
  }

  const before = audit.before as Record<string, unknown> | null;
  const after = audit.after as Record<string, unknown> | null;

  try {
    await applyUndo(audit.entity, audit.kind, audit.entityId, before, after);
  } catch (e) {
    return {
      ok: false,
      code: "STATE_CONFLICT",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // 撤回本身也写一条 AuditLog（kind 取反向）
  const reverseKind =
    audit.kind === "CREATE" ? "DELETE" : audit.kind === "DELETE" ? "CREATE" : "UPDATE";
  await prisma.auditLog.create({
    data: {
      familyId: input.familyId,
      actorId: input.actorId,
      kind: reverseKind,
      entity: audit.entity,
      entityId: audit.entityId,
      before: after as never,
      after: before as never,
    },
  });

  return {
    ok: true,
    auditId: input.auditId,
    message: `已撤回 ${audit.entity} 的 ${audit.kind} 操作`,
  };
}

async function applyUndo(
  entity: string,
  kind: "CREATE" | "UPDATE" | "DELETE",
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (kind === "CREATE") {
    // 撤回 CREATE = 删除该记录（Person / Family 走软删，其他硬删）
    await deleteByEntity(entity, entityId);
    return;
  }
  if (kind === "DELETE") {
    // 撤回 DELETE = 恢复该记录（Person / Family 软删→清 deletedAt；其他重建）
    if (!before) throw new Error("缺少 before 快照，无法恢复");
    await recreateByEntity(entity, entityId, before);
    return;
  }
  // UPDATE：恢复字段为 before
  if (!before) throw new Error("缺少 before 快照，无法恢复");
  await restoreFieldsByEntity(entity, entityId, before);
  // after 在这里没有用——恢复期间我们只关心 before。保留参数留作未来"差异化合并"扩展。
  void after;
}

async function deleteByEntity(entity: string, id: string) {
  switch (entity) {
    case "Person":
      await prisma.person.update({ where: { id }, data: { deletedAt: new Date() } });
      return;
    case "Family":
      await prisma.family.update({ where: { id }, data: { deletedAt: new Date() } });
      return;
    case "Marriage":
      await prisma.marriage.delete({ where: { id } });
      return;
    case "ParentChild":
      await prisma.parentChild.delete({ where: { id } });
      return;
    case "Migration":
      await prisma.migration.delete({ where: { id } });
      return;
    case "Branch":
      await prisma.branch.delete({ where: { id } });
      return;
    default:
      throw new Error(`不支持的实体：${entity}`);
  }
}

/**
 * 重建 entity（用于撤回 DELETE）。
 *
 * 对软删模型（Person / Family），优先尝试 update deletedAt = null；
 * 如果记录已被硬删则用 before 重建。
 */
async function recreateByEntity(
  entity: string,
  id: string,
  before: Record<string, unknown>,
) {
  // 软删型
  if (entity === "Person") {
    const existing = await prisma.person.findUnique({ where: { id } });
    if (existing) {
      await prisma.person.update({ where: { id }, data: { deletedAt: null } });
      return;
    }
    await prisma.person.create({ data: stripDates(before) as never });
    return;
  }
  if (entity === "Family") {
    const existing = await prisma.family.findUnique({ where: { id } });
    if (existing) {
      await prisma.family.update({ where: { id }, data: { deletedAt: null } });
      return;
    }
    await prisma.family.create({ data: stripDates(before) as never });
    return;
  }
  // 硬删型：直接 create
  switch (entity) {
    case "Marriage":
      await prisma.marriage.create({ data: stripDates(before) as never });
      return;
    case "ParentChild":
      await prisma.parentChild.create({ data: stripDates(before) as never });
      return;
    case "Migration":
      await prisma.migration.create({ data: stripDates(before) as never });
      return;
    case "Branch":
      await prisma.branch.create({ data: stripDates(before) as never });
      return;
    default:
      throw new Error(`不支持的实体：${entity}`);
  }
}

async function restoreFieldsByEntity(
  entity: string,
  id: string,
  before: Record<string, unknown>,
) {
  // 字段集合：取 before 的标量字段（去掉 createdAt / updatedAt / id）。
  const data = stripImmutable(before);
  switch (entity) {
    case "Person":
      await prisma.person.update({ where: { id }, data: data as never });
      return;
    case "Marriage":
      await prisma.marriage.update({ where: { id }, data: data as never });
      return;
    case "ParentChild":
      await prisma.parentChild.update({ where: { id }, data: data as never });
      return;
    case "Migration":
      await prisma.migration.update({ where: { id }, data: data as never });
      return;
    case "Branch":
      await prisma.branch.update({ where: { id }, data: data as never });
      return;
    case "Family":
      await prisma.family.update({ where: { id }, data: data as never });
      return;
    default:
      throw new Error(`不支持的实体：${entity}`);
  }
}

function stripDates(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  // ISO 字符串 → Date
  for (const k of ["createdAt", "updatedAt", "deletedAt", "joinedAt"]) {
    if (typeof out[k] === "string") {
      out[k] = new Date(out[k] as string);
    }
  }
  return out;
}

function stripImmutable(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  delete out.id;
  delete out.createdAt;
  delete out.updatedAt;
  // 关系外键沿用之前值（已在 before 里），删除关系展开字段以免与外键冲突
  delete out.family;
  delete out.husband;
  delete out.wife;
  delete out.parent;
  delete out.child;
  delete out.branch;
  delete out.fromLocation;
  delete out.toLocation;
  delete out.residence;
  delete out.rootPerson;
  delete out.location;
  // ISO → Date
  for (const k of ["deletedAt", "joinedAt"]) {
    if (typeof out[k] === "string") {
      out[k] = new Date(out[k] as string);
    } else if (out[k] === null) {
      // keep as null
    }
  }
  return out;
}
