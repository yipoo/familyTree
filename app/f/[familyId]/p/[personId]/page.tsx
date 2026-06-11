/**
 * 人物详情页
 *
 * 路由：/f/[familyId]/p/[personId]
 *
 * 数据：
 *   - 人物基本信息
 *   - 父母（含过继 / 嫁入辨析）
 *   - 婚配（含原配 / 继配 / 入赘）
 *   - 子女（按 birthOrder 排序）
 *   - 兄弟姐妹
 *   - 迁徙记录（个人级）
 *   - 居住地（含继承解析）
 *   - 最近 10 条审计日志
 *
 * 权限：FamilyRole.MEMBER 以上可读；写权限通过 PersonDetailActions 内部 API 调用控制。
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteOnPerson } from "@/lib/auth/guard";
import type { Gender, MarriageType } from "@/lib/generated/prisma/enums";
import { PersonDetailActions } from "./PersonDetailActions";
import { MigrationsPanel } from "@/components/migrations/MigrationsPanel";
import { MediaGallery } from "@/components/media/MediaGallery";
import { ossConfigured } from "@/lib/services/oss";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "男",
  FEMALE: "女",
  UNKNOWN: "—",
};

const MARRIAGE_TYPE_LABEL: Record<MarriageType, string> = {
  PRIMARY: "原配",
  SECONDARY: "继配",
  CONCUBINE: "妾",
  UXORILOCAL: "入赘",
};

const STATUS_LABEL: Record<string, string> = {
  ALIVE: "在世",
  DECEASED: "已故",
  LOST: "失联",
  UNKNOWN: "未知",
};

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ familyId: string; personId: string }>;
}) {
  const { familyId, personId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/p/${personId}`)}`);
  }

  // 权限检查 + 顺带读出 platformRole
  const meRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true, name: true, phone: true },
  });
  if (!meRow) redirect("/login");

  // 该人物是否可读：成员 + 非软删
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId, familyId } },
    select: { role: true },
  });
  if (!member && meRow.platformRole !== "SUPERADMIN") {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-semibold">无权访问</h1>
        <p className="mt-2 text-sm text-zinc-500">该家族不在你的成员列表中。</p>
        <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
          返回我的家族
        </Link>
      </div>
    );
  }

  const person = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
    include: {
      family: { select: { name: true, surname: true } },
      branch: { select: { id: true, name: true } },
      residence: true,
      marriagesAsHusband: {
        orderBy: { order: "asc" },
        include: { wife: true },
      },
      marriagesAsWife: {
        orderBy: { order: "asc" },
        include: { husband: true },
      },
      childRelations: {
        include: { parent: true },
      },
      parentRelations: {
        include: { child: true },
        orderBy: { birthOrder: "asc" },
      },
      migrations: {
        orderBy: { year: "asc" },
        include: { fromLocation: true, toLocation: true },
      },
    },
  });

  if (!person) notFound();

  // 兄弟姐妹：与本人共享父母（任一即可）
  const siblings = await (async () => {
    const parentIds = person.childRelations.map((r) => r.parentId);
    if (parentIds.length === 0) return [] as Awaited<ReturnType<typeof prisma.person.findMany>>;
    const sibsRel = await prisma.parentChild.findMany({
      where: {
        familyId,
        parentId: { in: parentIds },
        childId: { not: personId },
      },
      include: {
        child: true,
      },
    });
    const seen = new Set<string>();
    const arr: typeof sibsRel[number]["child"][] = [];
    for (const r of sibsRel) {
      if (seen.has(r.childId)) continue;
      if (r.child.deletedAt) continue;
      seen.add(r.childId);
      arr.push(r.child);
    }
    arr.sort((a, b) => (a.birthOrder ?? 99) - (b.birthOrder ?? 99));
    return arr;
  })();

  // 居住地：若 person 自身无 residence，按规则上溯解析
  const resolvedResidence = await (async () => {
    if (person.residence) return { ...person.residence, fromPersonId: person.id };
    // 简易上溯：嫁入跟夫，否则跟父
    let cur: { id: string; isMarriedIn: boolean; residenceId: string | null } | null = {
      id: person.id,
      isMarriedIn: person.isMarriedIn,
      residenceId: person.residenceId,
    };
    const seen = new Set<string>([person.id]);
    let depth = 0;
    while (cur && depth < 32) {
      if (cur.residenceId) {
        const loc = await prisma.location.findUnique({ where: { id: cur.residenceId } });
        if (loc) return { ...loc, fromPersonId: cur.id };
      }
      let nextId: string | null = null;
      if (cur.isMarriedIn) {
        const mr: { husbandId: string } | null = await prisma.marriage.findFirst({
          where: { wifeId: cur.id },
          orderBy: { order: "asc" },
          select: { husbandId: true },
        });
        nextId = mr?.husbandId ?? null;
      } else {
        const pc: { parentId: string } | null = await prisma.parentChild.findFirst({
          where: { childId: cur.id, isPrimary: true, parent: { gender: "MALE" } },
          select: { parentId: true },
        });
        nextId = pc?.parentId ?? null;
      }
      if (!nextId || seen.has(nextId)) break;
      seen.add(nextId);
      const nxt: { id: string; isMarriedIn: boolean; residenceId: string | null } | null =
        await prisma.person.findUnique({
          where: { id: nextId },
          select: { id: true, isMarriedIn: true, residenceId: true },
        });
      cur = nxt;
      depth++;
    }
    return null;
  })();

  // 最近审计日志
  const audits = await prisma.auditLog.findMany({
    where: { familyId, entity: "Person", entityId: personId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const actorIds = [...new Set(audits.map((a) => a.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorById = new Map(actors.map((u) => [u.id, u.name]));

  const father = person.childRelations.find((r) => r.parent.gender === "MALE")?.parent ?? null;
  const mother = person.childRelations.find((r) => r.parent.gender === "FEMALE")?.parent ?? null;

  const sessionUser = {
    id: meRow.id,
    phone: meRow.phone,
    name: meRow.name,
    platformRole: meRow.platformRole,
  };
  const canEdit = await canWriteOnPerson(sessionUser, familyId, personId);

  const marriages =
    person.gender === "MALE"
      ? person.marriagesAsHusband.map((m) => ({
          id: m.id,
          partner: m.wife,
          type: m.type,
          order: m.order,
          marriedYear: m.marriedYear,
          endedYear: m.endedYear,
          endedReason: m.endedReason,
          note: m.note,
        }))
      : person.marriagesAsWife.map((m) => ({
          id: m.id,
          partner: m.husband,
          type: m.type,
          order: m.order,
          marriedYear: m.marriedYear,
          endedYear: m.endedYear,
          endedReason: m.endedReason,
          note: m.note,
        }));

  const children = person.parentRelations
    .filter((r) => !r.child.deletedAt)
    .map((r) => r.child);

  return (
    <div>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6">
          <nav aria-label="面包屑" className="text-xs text-fg-subtle">
            <Link href="/" className="transition hover:text-foreground">
              我的家族
            </Link>
            <span className="mx-1">/</span>
            <Link href={`/f/${familyId}`} className="transition hover:text-foreground">
              {person.family.name}
            </Link>
            <span className="mx-1">/</span>
            <Link
              href={`/f/${familyId}/tree?focus=${person.id}`}
              className="transition hover:text-foreground"
            >
              树谱
            </Link>
            <span className="mx-1">/</span>
            <span className="text-foreground">人物</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.avatarUrl}
                alt={person.name}
                className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-md"
              />
            ) : (
              <span
                aria-hidden
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold shadow-md ${
                  person.gender === "FEMALE"
                    ? "bg-pink-500 text-white"
                    : person.gender === "MALE"
                    ? "bg-brand text-brand-fg"
                    : "bg-muted text-fg-muted"
                }`}
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {person.name?.[0] ?? "氏"}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {person.name}
                {person.alias && (
                  <span className="ml-2 text-base font-normal text-fg-subtle">
                    （{person.alias}）
                  </span>
                )}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                <span>第 {person.generation} 世</span>
                {person.generationChar && (
                  <span>字辈 {person.generationChar}</span>
                )}
                {person.birthOrder && <span>行 {person.birthOrder}</span>}
                {person.isMarriedIn && (
                  <span className="rounded bg-pink-50 px-1.5 py-0.5 text-pink-700 dark:bg-pink-950/40 dark:text-pink-200">
                    嫁入
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    person.status === "DECEASED"
                      ? "bg-muted text-fg-muted"
                      : person.status === "ALIVE"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  {STATUS_LABEL[person.status] ?? person.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-3 py-6 sm:px-5 lg:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {/* ---------------- 主信息 ---------------- */}
          <section className="md:col-span-2 space-y-4">
            <Card title="基本信息">
              <DList>
                <DItem k="姓名">{person.name}</DItem>
                <DItem k="性别">{GENDER_LABEL[person.gender]}</DItem>
                {person.alias && <DItem k="别名">{person.alias}</DItem>}
                <DItem k="世代">第 {person.generation} 世</DItem>
                {person.generationChar && (
                  <DItem k="字辈">{person.generationChar}</DItem>
                )}
                {person.birthOrder && <DItem k="排行">{person.birthOrder}</DItem>}
                {(person.birthYear || person.birthDate) && (
                  <DItem k="生年">
                    {person.birthDate || (person.birthYear ? `${person.birthYear}` : "—")}
                  </DItem>
                )}
                {(person.deathYear || person.deathDate) && (
                  <DItem k="卒年">
                    {person.deathDate || (person.deathYear ? `${person.deathYear}` : "—")}
                  </DItem>
                )}
                {person.birthPlace && <DItem k="出生地">{person.birthPlace}</DItem>}
                {person.succession && <DItem k="出承">{person.succession}</DItem>}
                {person.branch && <DItem k="支系">{person.branch.name}</DItem>}
                {resolvedResidence && (
                  <DItem k="居住地">
                    {resolvedResidence.fullText}
                    {resolvedResidence.fromPersonId !== person.id && (
                      <span className="ml-1 text-xs text-zinc-500">（继承自上代）</span>
                    )}
                  </DItem>
                )}
              </DList>
            </Card>

            {(person.biography || person.note || person.noteHint || person.paperRecord) && (
              <Card title="文字记述">
                <div className="space-y-3 text-sm">
                  {person.biography && (
                    <Para label="个人传记" content={person.biography} />
                  )}
                  {person.paperRecord && (
                    <Para label="纸谱行传" content={person.paperRecord} />
                  )}
                  {person.noteHint && (
                    <Para label="线索备注" content={person.noteHint} />
                  )}
                  {person.note && <Para label="备注" content={person.note} />}
                </div>
              </Card>
            )}

            {/* 关系 —— 父母 */}
            <Card title="父母">
              {father || mother ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {father && (
                    <RelLink
                      familyId={familyId}
                      person={father}
                      label="父"
                      tone="blue"
                    />
                  )}
                  {mother && (
                    <RelLink
                      familyId={familyId}
                      person={mother}
                      label="母"
                      tone="pink"
                    />
                  )}
                </div>
              ) : (
                <Empty>未记录父母</Empty>
              )}
            </Card>

            {/* 婚配 */}
            <Card title="婚配">
              {marriages.length > 0 ? (
                <ul className="space-y-2">
                  {marriages.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-baseline gap-2 rounded border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <Link
                        href={`/f/${familyId}/p/${m.partner.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {m.partner.name}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        {MARRIAGE_TYPE_LABEL[m.type]}
                        {m.order > 1 && ` · 第${m.order}`}
                      </span>
                      {m.marriedYear && (
                        <span className="text-xs text-zinc-500">
                          {m.marriedYear}年成婚
                        </span>
                      )}
                      {m.endedYear && (
                        <span className="text-xs text-zinc-500">
                          {m.endedYear}年止
                          {m.endedReason && `（${m.endedReason}）`}
                        </span>
                      )}
                      {m.note && (
                        <span className="text-xs text-zinc-500">备注：{m.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>未记录婚配</Empty>
              )}
            </Card>

            {/* 子女 */}
            <Card title={`子女（${children.length}）`}>
              {children.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {children.map((c) => (
                    <li key={c.id}>
                      <RelLink
                        familyId={familyId}
                        person={c}
                        label={c.gender === "MALE" ? "子" : c.gender === "FEMALE" ? "女" : ""}
                        tone={c.gender === "MALE" ? "blue" : c.gender === "FEMALE" ? "pink" : "zinc"}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>未记录子女</Empty>
              )}
            </Card>

            {/* 兄弟姐妹 */}
            {siblings.length > 0 && (
              <Card title={`同父母兄弟姐妹（${siblings.length}）`}>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <RelLink
                        familyId={familyId}
                        person={s}
                        label={s.gender === "MALE" ? "兄/弟" : s.gender === "FEMALE" ? "姐/妹" : ""}
                        tone={s.gender === "MALE" ? "blue" : s.gender === "FEMALE" ? "pink" : "zinc"}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 迁徙：客户端面板，可读+可写 */}
            <Card title={`迁徙（${person.migrations.length}）`}>
              <MigrationsPanel
                familyId={familyId}
                scope="PERSON"
                personId={personId}
                canEdit={canEdit}
              />
            </Card>

            {/* 影像相册：照片 / 文档 / 老谱扫描件 / 录音 */}
            <MediaGallery
              familyId={familyId}
              personId={personId}
              canWrite={canEdit}
              ossReady={ossConfigured()}
            />
          </section>

          {/* ---------------- 边栏 ---------------- */}
          <aside className="space-y-4">
            <Card title="导航">
              <div className="flex flex-col gap-1.5 text-sm">
                <Link
                  href={`/f/${familyId}/tree?focus=${person.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  在树视图中聚焦 →
                </Link>
                <Link
                  href={`/f/${familyId}/table`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  详细表 →
                </Link>
                {canEdit && (
                  <Link
                    href={`/f/${familyId}/admin`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    家族管理 →
                  </Link>
                )}
              </div>
            </Card>

            {canEdit && (
              <PersonDetailActions
                familyId={familyId}
                personId={personId}
                personName={person.name}
              />
            )}

            {audits.length > 0 && (
              <Card title="最近变更">
                <ul className="space-y-2 text-xs">
                  {audits.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-col rounded border border-zinc-100 px-2 py-1 dark:border-zinc-800"
                    >
                      <span className="font-medium">
                        {a.kind === "CREATE" && "创建"}
                        {a.kind === "UPDATE" && "更新"}
                        {a.kind === "DELETE" && "删除"}
                        {a.kind === "APPROVE" && "审批通过"}
                        {a.kind === "REJECT" && "审批驳回"}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(a.createdAt).toLocaleString("zh-CN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {actorById.get(a.actorId) ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
      {children}
    </dl>
  );
}

function DItem({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="font-medium text-zinc-900 dark:text-zinc-50">{children}</dd>
    </div>
  );
}

function Para({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-zinc-500">{label}</h3>
      <p className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
        {content}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}

function RelLink({
  familyId,
  person,
  label,
  tone,
}: {
  familyId: string;
  person: { id: string; name: string; gender: Gender; status: string; isMarriedIn: boolean; alias: string | null };
  label: string;
  tone: "blue" | "pink" | "zinc";
}) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900"
      : tone === "pink"
        ? "bg-pink-50 hover:bg-pink-100 dark:bg-pink-950 dark:hover:bg-pink-900"
        : "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800";
  return (
    <Link
      href={`/f/${familyId}/p/${person.id}`}
      className={`flex items-baseline gap-1.5 rounded px-2 py-1.5 text-sm transition ${toneCls}`}
    >
      {label && <span className="text-xs text-zinc-500">{label}</span>}
      <span className="font-medium text-zinc-900 dark:text-zinc-50">{person.name}</span>
      {person.alias && (
        <span className="text-xs text-zinc-500">（{person.alias}）</span>
      )}
      {person.isMarriedIn && (
        <span className="text-[10px] text-pink-700 dark:text-pink-200">嫁入</span>
      )}
      {person.status === "DECEASED" && (
        <span className="text-xs text-zinc-400">†</span>
      )}
    </Link>
  );
}
