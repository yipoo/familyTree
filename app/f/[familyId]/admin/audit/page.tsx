/**
 * 审计日志查看页（仅 ADMIN+ 可见，admin layout 已校验权限）。
 * 路由：/f/[familyId]/admin/audit
 */
import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";

import { AdminSection } from "../_shared";
import { AuditLogTable } from "./AuditLogTable";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ entity?: string; kind?: string; actorId?: string }>;
}) {
  const { familyId } = await params;
  const { entity, kind, actorId } = await searchParams;
  // OWNER / ADMIN 才允许撤回
  const auth = await requireFamilyRole(familyId, "ADMIN");
  const canUndo =
    auth.role === "OWNER" ||
    auth.role === "ADMIN" ||
    auth.user.platformRole === "SUPERADMIN";

  const where: Record<string, unknown> = { familyId };
  if (entity) where.entity = entity;
  if (kind) where.kind = kind;
  if (actorId) where.actorId = actorId;

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actorIds = [...new Set(items.map((a) => a.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const actorById = new Map(actors.map((u) => [u.id, u]));

  // 实体维度统计
  const byEntity = await prisma.auditLog.groupBy({
    by: ["entity"],
    where: { familyId },
    _count: { _all: true },
    orderBy: { _count: { entity: "desc" } },
  });
  const byKind = await prisma.auditLog.groupBy({
    by: ["kind"],
    where: { familyId },
    _count: { _all: true },
  });

  return (
    <AdminSection
      title="审计日志"
      description={`记录所有写操作（创建 / 修改 / 删除 / 审批），点击"详情"查看 before / after 快照。`}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="实体类型" value={byEntity.length} />
        <Stat label="总条数" value={byEntity.reduce((s, x) => s + x._count._all, 0)} />
        {byKind.map((k) => (
          <Stat
            key={k.kind}
            label={kindLabel(k.kind)}
            value={k._count._all}
          />
        ))}
      </div>

      <FilterBar
        familyId={familyId}
        currentEntity={entity ?? ""}
        currentKind={kind ?? ""}
        entities={byEntity.map((e) => e.entity)}
      />

      <div className="mt-4">
        <AuditLogTable
          familyId={familyId}
          canUndo={canUndo}
          items={items.map((a) => ({
            id: a.id,
            entity: a.entity,
            entityId: a.entityId,
            kind: a.kind,
            createdAt: a.createdAt.toISOString(),
            actorName: actorById.get(a.actorId)?.name ?? "—",
            actorPhone: actorById.get(a.actorId)?.phone ?? null,
            before: a.before,
            after: a.after,
          }))}
        />
      </div>
    </AdminSection>
  );
}

function FilterBar({
  familyId,
  currentEntity,
  currentKind,
  entities,
}: {
  familyId: string;
  currentEntity: string;
  currentKind: string;
  entities: string[];
}) {
  return (
    <form
      method="get"
      action={`/f/${familyId}/admin/audit`}
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      <label>
        实体：
        <select
          name="entity"
          defaultValue={currentEntity}
          className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">全部</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <label>
        类型：
        <select
          name="kind"
          defaultValue={currentKind}
          className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">全部</option>
          <option value="CREATE">创建</option>
          <option value="UPDATE">修改</option>
          <option value="DELETE">删除</option>
          <option value="APPROVE">审批通过</option>
          <option value="REJECT">审批驳回</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
      >
        过滤
      </button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-zinc-500">{label}</div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

function kindLabel(k: string): string {
  switch (k) {
    case "CREATE":
      return "创建";
    case "UPDATE":
      return "修改";
    case "DELETE":
      return "删除";
    case "APPROVE":
      return "审批通过";
    case "REJECT":
      return "审批驳回";
    default:
      return k;
  }
}
