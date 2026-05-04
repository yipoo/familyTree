import Link from "next/link";

import { prisma } from "@/lib/db";
import { loadShareLink } from "@/lib/auth/share";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await loadShareLink(token);

  if (!link) return <Invalid title="链接不存在" />;
  if (link.expired) return <Invalid title="链接已过期" />;

  const [family, persons, generationNames] = await Promise.all([
    prisma.family.findUnique({
      where: { id: link.familyId },
      select: { id: true, name: true, surname: true, description: true, deletedAt: true },
    }),
    prisma.person.findMany({
      where: { familyId: link.familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        gender: true,
        generation: true,
        generationChar: true,
        birthOrder: true,
        isMarriedIn: true,
        status: true,
        birthYear: true,
        deathYear: true,
      },
      orderBy: [{ generation: "asc" }, { birthOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.generationName.findMany({
      where: { familyId: link.familyId },
      orderBy: { generation: "asc" },
    }),
  ]);

  if (!family || family.deletedAt) return <Invalid title="家族不存在" />;

  const stats = {
    total: persons.length,
    male: persons.filter((p) => p.gender === "MALE").length,
    female: persons.filter((p) => p.gender === "FEMALE").length,
  };

  // 按世代分组
  const byGen = new Map<number, typeof persons>();
  for (const p of persons) {
    const arr = byGen.get(p.generation) ?? [];
    arr.push(p);
    byGen.set(p.generation, arr);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);
  const charByGen = new Map(generationNames.map((g) => [g.generation, g.character]));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>分享只读视图</span>
            <Link href="/login" className="text-blue-600 hover:underline">
              登录后查看完整功能 →
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {family.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">{family.surname} 姓</p>
          {family.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {family.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              人数 <strong className="text-zinc-900 dark:text-zinc-50">{stats.total}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              男 <strong className="text-blue-600">{stats.male}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              女 <strong className="text-pink-600">{stats.female}</strong>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {generationNames.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              字辈表
            </h2>
            <div className="flex flex-wrap gap-2">
              {generationNames.map((g) => (
                <div
                  key={g.id}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-zinc-500">{g.generation} 世</span>
                  <span className="ml-1.5 font-semibold">{g.character}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            按世代浏览
          </h2>
          <div className="space-y-4">
            {generations.map((gen) => {
              const list = byGen.get(gen)!;
              return (
                <div
                  key={gen}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-baseline gap-2 text-sm">
                    <strong className="text-zinc-900 dark:text-zinc-50">
                      第 {gen} 世
                    </strong>
                    {charByGen.get(gen) && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                        字辈 {charByGen.get(gen)}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {list.length} 人
                    </span>
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-baseline gap-2 rounded border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
                      >
                        <span
                          className={
                            p.gender === "MALE"
                              ? "h-2 w-2 shrink-0 rounded-full bg-blue-500"
                              : p.gender === "FEMALE"
                                ? "h-2 w-2 shrink-0 rounded-full bg-pink-500"
                                : "h-2 w-2 shrink-0 rounded-full bg-zinc-400"
                          }
                          aria-hidden
                        />
                        <span className="font-medium">{p.name}</span>
                        {p.alias && (
                          <span className="text-xs text-zinc-500">
                            ({p.alias})
                          </span>
                        )}
                        {p.isMarriedIn && (
                          <span className="rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            嫁入
                          </span>
                        )}
                        {(p.birthYear || p.deathYear) && (
                          <span className="ml-auto text-[11px] text-zinc-400">
                            {p.birthYear ?? "?"}–{p.deathYear ?? ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-zinc-400">
          只读分享 · 不显示亲子关系详情 · 完整树视图请登录后查看
        </p>
      </main>
    </div>
  );
}

function Invalid({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          请联系家族管理员重新生成链接。
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          去登录
        </Link>
      </div>
    </div>
  );
}
