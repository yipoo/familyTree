/**
 * 异步 PDF 渲染队列。
 *
 * 设计：
 *   - 持久化用 PdfJob 表（status / progress / outputBytes 等）
 *   - 进程内 in-memory queue，并发上限 1（PDF 渲染是 CPU + 字体内存大户，
 *     并发会让 10000+ 人的家族吃光内存）
 *   - 进程重启时未完成 RUNNING 任务在 worker 启动钩子里重置回 PENDING
 *   - 接口可替换：未来上 BullMQ / Redis 只需重写 enqueue / 启动 worker
 *
 * 同步阈值：family 人数 < SYNC_PERSON_THRESHOLD 时，老的 GET 路径仍同步生成；
 * 超过则统一进异步队列。
 *
 * 测试：runJobInline 暴露给单测调用——不依赖后台 worker 调度。
 */
import { prisma } from "@/lib/db";
import { buildAlbumBook } from "@/lib/services/album";
import { layoutLineageChart } from "@/lib/services/lineage-chart";
import { renderAlbumPdf } from "@/lib/pdf/album";
import { renderLineageChartPdf } from "@/lib/pdf/lineage-chart";
import type {
  PdfJobStatus as PdfJobStatusType,
  PdfJobType as PdfJobTypeEnum,
} from "@/lib/generated/prisma/enums";

/** 家族人数低于此阈值时，老接口直接同步生成 PDF（不进队列） */
export const SYNC_PERSON_THRESHOLD = 300;

interface RunningTask {
  jobId: string;
  promise: Promise<void>;
}

let pending: string[] = [];
let running: RunningTask | null = null;
let workerStarted = false;

export interface CreateJobInput {
  familyId: string;
  type: PdfJobTypeEnum;
  requestedById: string;
  params?: Record<string, unknown>;
}

export async function createJob(input: CreateJobInput) {
  const job = await prisma.pdfJob.create({
    data: {
      familyId: input.familyId,
      type: input.type,
      requestedById: input.requestedById,
      params: (input.params ?? {}) as never,
      status: "PENDING",
      progress: 0,
    },
    select: { id: true, status: true, type: true },
  });
  enqueue(job.id);
  return job;
}

function enqueue(jobId: string) {
  if (!pending.includes(jobId)) pending.push(jobId);
  ensureWorker();
}

function ensureWorker() {
  if (running) return;
  const next = pending.shift();
  if (!next) return;
  const promise = runJobInline(next).finally(() => {
    running = null;
    // 立刻看下还有没有
    setImmediate(() => ensureWorker());
  });
  running = { jobId: next, promise };
}

/**
 * 进程启动时调用一次，把上一次中途 RUNNING 的任务复活成 PENDING 重排。
 * Next.js 16 的 Route Handler 没有专门的 startup hook，所以由首次访问
 * `/api/families/.../pdf-jobs` 时延迟初始化（idempotent）。
 */
export async function bootstrapQueue() {
  if (workerStarted) return;
  workerStarted = true;
  const stale = await prisma.pdfJob.findMany({
    where: { status: "RUNNING" },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.pdfJob.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: "PENDING", progress: 0 },
    });
  }
  // 把 PENDING 的全部入队（按 createdAt asc）
  const pendingFromDb = await prisma.pdfJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const j of pendingFromDb) enqueue(j.id);
}

/**
 * 立即执行一个 job（被 ensureWorker 调用，也可被测试直接 await）。
 */
export async function runJobInline(jobId: string): Promise<void> {
  const job = await prisma.pdfJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "DONE" || job.status === "FAILED" || job.status === "CANCELED") return;

  await prisma.pdfJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), progress: 5 },
  });

  try {
    const params = (job.params ?? {}) as Record<string, unknown>;
    const { bytes, name } = await renderJob(job.familyId, job.type, params, async (p) => {
      await prisma.pdfJob.update({
        where: { id: jobId },
        data: { progress: Math.max(0, Math.min(99, Math.floor(p))) },
      });
    });
    await prisma.pdfJob.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        progress: 100,
        outputBytes: Buffer.from(bytes),
        outputName: name,
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.pdfJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: msg.slice(0, 1000),
        finishedAt: new Date(),
      },
    });
  }
}

async function renderJob(
  familyId: string,
  type: PdfJobTypeEnum,
  params: Record<string, unknown>,
  onProgress: (pct: number) => Promise<void>,
): Promise<{ bytes: Uint8Array; name: string }> {
  if (type === "ALBUM") {
    await onProgress(15);
    const book = await buildAlbumBook(familyId);
    if (!book) throw new Error("Family not found");
    await onProgress(40);
    const buf = await renderAlbumPdf(book);
    await onProgress(95);
    return {
      bytes: new Uint8Array(buf),
      name: `album-${book.family.surname}-${book.family.name}.pdf`,
    };
  }

  // LINEAGE_CHART
  const rootParam = typeof params.root === "string" ? params.root : null;
  const [family, persons, marriages, parentChild] = await Promise.all([
    prisma.family.findUnique({
      where: { id: familyId },
      include: {
        generationNames: { orderBy: { generation: "asc" } },
        branches: { orderBy: { name: "asc" } },
      },
    }),
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        generation: true,
        generationChar: true,
        gender: true,
        isMarriedIn: true,
        birthOrder: true,
        birthYear: true,
        deathYear: true,
        status: true,
        succession: true,
      },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { husbandId: true, wifeId: true, type: true, order: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, birthOrder: true },
    }),
  ]);
  if (!family) throw new Error("Family not found");
  await onProgress(25);

  let rootId: string | null = null;
  if (rootParam) rootId = persons.find((p) => p.id === rootParam)?.id ?? null;
  if (!rootId) rootId = family.branches[0]?.rootPersonId ?? null;
  if (!rootId) {
    const minGen = persons.reduce(
      (m, p) => Math.min(m, p.generation),
      Number.POSITIVE_INFINITY,
    );
    rootId =
      persons.find((p) => p.generation === minGen && p.gender === "MALE")?.id ??
      persons.find((p) => p.generation === minGen)?.id ??
      null;
  }
  if (!rootId) throw new Error("暂无可绘制的人物");

  const layout = layoutLineageChart({
    rootPersonId: rootId,
    persons,
    parentChild,
    marriages,
  });
  await onProgress(55);

  const generationChars = Object.fromEntries(
    family.generationNames.map((g) => [g.generation, g.character]),
  );
  const rootName = persons.find((p) => p.id === rootId)?.name ?? "";

  const buf = await renderLineageChartPdf({
    title: family.name,
    subtitle: `首祖 ${rootName} 起 · 共 ${layout.generations.length} 代 · ${layout.nodes.length} 人`,
    layout,
    generationChars,
  });
  await onProgress(95);

  return {
    bytes: new Uint8Array(buf),
    name: `lineage-${family.surname}-${rootName}.pdf`,
  };
}

/**
 * 取得家族人数（用于决定走同步还是异步）。
 */
export async function familyPersonCount(familyId: string): Promise<number> {
  return prisma.person.count({ where: { familyId, deletedAt: null } });
}

/**
 * 测试 / 调试钩子——清空内存队列状态。
 */
export function _resetQueueForTest() {
  pending = [];
  running = null;
  workerStarted = false;
}

export type { PdfJobStatusType, PdfJobTypeEnum };
