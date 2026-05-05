import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
  var __demoPrisma: PrismaClient | undefined;
}

function createClient(connectionString: string | undefined) {
  // 容忍 connectionString 为空：与旧行为一致，PrismaPg 在首次查询时才 fail。
  // 这避免了在测试 / 构建（无 DATABASE_URL）时 import 即崩溃。
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * 生产数据库（DATABASE_URL）。所有真实用户、家族、审计写入都走这里。
 */
export const prisma =
  globalThis.__prisma ?? createClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * Demo 数据库（DATABASE_URL_DEMO）。
 *
 * - 仅 /share/demo 与未来 demo-only 路由使用
 * - 与生产库物理隔离，可独立 reset / seed / 私有 schema 演进
 * - 未配置时返回 null：调用方需自行渲染"演示数据未初始化"
 *
 * **重要约束**：除 demo 路由外，应用代码任何地方都不应 import demoPrisma。
 * seed.ts 强制只接受 DATABASE_URL_DEMO，从而保证 `pnpm db:seed` 永远不会清空生产。
 */
export const demoPrisma: PrismaClient | null = (() => {
  if (globalThis.__demoPrisma) return globalThis.__demoPrisma;
  const url = process.env.DATABASE_URL_DEMO;
  if (!url) return null;
  const client = createClient(url);
  if (process.env.NODE_ENV !== "production") {
    globalThis.__demoPrisma = client;
  }
  return client;
})();
