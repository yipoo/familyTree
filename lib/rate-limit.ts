/**
 * 内存级限流（token bucket / 滑动窗口）—— 纯算法核心。
 *
 * 单实例部署够用：当前部署形态是单 Node 进程 + 单 Postgres，限流的目的
 * 是阻挡明显异常的密集调用，不需要分布式精确计数。
 *
 * 设计：
 *   - 每个 key 维护一个滑动窗口的命中时间戳数组（数组长度即当前命中数）
 *   - 超过 limit → 拒绝（拒绝不消耗未超限 key 的配额）
 *   - 不依赖外部服务；进程重启清空状态（可接受：限流非关键安全机制）
 *   - 全局 LRU 上限 10000 个 key，防止内存泄漏
 *
 * 双键：同一请求传入多个 key（通常 ["ip:x", "user:y"]）会分别计数，
 * 任一桶超限即拒绝；这样能同时阻挡"单 IP 暴力"和"单账号扫号"。
 *
 * Next.js Route Handler 包装见 `lib/rate-limit-middleware.ts`。
 *
 * 测试：用 `setNow()` / `clearAll()` 直接操控时间和清状态。
 */

const MAX_KEYS = 10_000;

type Entry = {
  hits: number[]; // 命中时间戳 ms
  lastAccess: number;
};

const buckets = new Map<string, Map<string, Entry>>();

let _now: () => number = () => Date.now();

export function setNow(fn: () => number) {
  _now = fn;
}

export function resetNow() {
  _now = () => Date.now();
}

export function clearAll() {
  buckets.clear();
}

function getBucket(name: string): Map<string, Entry> {
  let b = buckets.get(name);
  if (!b) {
    b = new Map();
    buckets.set(name, b);
  }
  return b;
}

function evictIfNeeded(bucket: Map<string, Entry>) {
  if (bucket.size <= MAX_KEYS) return;
  const entries = [...bucket.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess,
  );
  const drop = Math.ceil(entries.length / 4);
  for (let i = 0; i < drop; i++) {
    bucket.delete(entries[i][0]);
  }
}

export interface RateLimitOptions {
  /** 桶名，独立计数 */
  bucket: string;
  /** 窗口内允许命中数 */
  limit: number;
  /** 窗口长度 ms */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** 距离窗口最早一次命中过期的秒数（向上取整） */
  retryAfterSec: number;
}

/**
 * 检查一组 key（任一超限即拒绝），并记录命中。
 * - 如果任一 key 超过 limit：不写入新命中，返回 ok=false
 * - 否则：每个 key 都写入一个命中
 */
export function check(keys: string[], opts: RateLimitOptions): RateLimitResult {
  const now = _now();
  const cutoff = now - opts.windowMs;
  const bucket = getBucket(opts.bucket);

  let blocked = false;
  let minRetry = 0;
  for (const k of keys) {
    const e = bucket.get(k);
    if (!e) continue;
    while (e.hits.length && e.hits[0] < cutoff) e.hits.shift();
    if (e.hits.length >= opts.limit) {
      blocked = true;
      const retry = Math.max(1, Math.ceil((e.hits[0] + opts.windowMs - now) / 1000));
      if (retry > minRetry) minRetry = retry;
    }
  }

  if (blocked) {
    return { ok: false, remaining: 0, retryAfterSec: minRetry };
  }

  for (const k of keys) {
    let e = bucket.get(k);
    if (!e) {
      e = { hits: [], lastAccess: now };
      bucket.set(k, e);
    }
    e.hits.push(now);
    e.lastAccess = now;
  }

  evictIfNeeded(bucket);

  let remaining = opts.limit;
  for (const k of keys) {
    const e = bucket.get(k);
    if (!e) continue;
    remaining = Math.min(remaining, opts.limit - e.hits.length);
  }
  return { ok: true, remaining: Math.max(0, remaining), retryAfterSec: 0 };
}

/**
 * 提取请求 IP（兼容多种代理头，回退 unknown）。
 */
export function ipOf(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fly = h.get("fly-client-ip");
  if (fly) return fly.trim();
  return "unknown";
}
