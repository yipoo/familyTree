import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { check, clearAll, resetNow, setNow } from "@/lib/rate-limit";

describe("rate-limit token bucket", () => {
  let now = 1_000_000;

  beforeEach(() => {
    clearAll();
    now = 1_000_000;
    setNow(() => now);
  });

  afterEach(() => {
    clearAll();
    resetNow();
  });

  it("放行未超限的请求并递减 remaining", () => {
    const opts = { bucket: "login", limit: 3, windowMs: 60_000 };
    const a = check(["ip:1"], opts);
    expect(a.ok).toBe(true);
    expect(a.remaining).toBe(2);
    const b = check(["ip:1"], opts);
    expect(b.remaining).toBe(1);
    const c = check(["ip:1"], opts);
    expect(c.remaining).toBe(0);
    const d = check(["ip:1"], opts);
    expect(d.ok).toBe(false);
    expect(d.retryAfterSec).toBeGreaterThan(0);
  });

  it("不同 key 独立计数", () => {
    const opts = { bucket: "login", limit: 2, windowMs: 60_000 };
    expect(check(["ip:A"], opts).ok).toBe(true);
    expect(check(["ip:A"], opts).ok).toBe(true);
    expect(check(["ip:A"], opts).ok).toBe(false);
    // ip:B 应该不受影响
    expect(check(["ip:B"], opts).ok).toBe(true);
    expect(check(["ip:B"], opts).ok).toBe(true);
    expect(check(["ip:B"], opts).ok).toBe(false);
  });

  it("不同 bucket 独立", () => {
    const a = { bucket: "login", limit: 1, windowMs: 60_000 };
    const b = { bucket: "register", limit: 1, windowMs: 60_000 };
    expect(check(["ip:X"], a).ok).toBe(true);
    expect(check(["ip:X"], a).ok).toBe(false);
    expect(check(["ip:X"], b).ok).toBe(true);
  });

  it("窗口滑动后释放配额", () => {
    const opts = { bucket: "code", limit: 2, windowMs: 10_000 };
    expect(check(["ip:1"], opts).ok).toBe(true);
    expect(check(["ip:1"], opts).ok).toBe(true);
    expect(check(["ip:1"], opts).ok).toBe(false);
    // 时间往前滑 11s
    now += 11_000;
    const r = check(["ip:1"], opts);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it("双键中任一超限即拒绝", () => {
    const opts = { bucket: "login", limit: 3, windowMs: 60_000 };
    // 先用 user:U 把 user 桶打到 3
    expect(check(["ip:1", "user:U"], opts).ok).toBe(true);
    expect(check(["ip:2", "user:U"], opts).ok).toBe(true);
    expect(check(["ip:3", "user:U"], opts).ok).toBe(true);
    // 此时 user:U 已经满了，即便换新 IP 也应被拦
    const r = check(["ip:4", "user:U"], opts);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("被拒绝时不消耗未超限 key 的配额", () => {
    const opts = { bucket: "login", limit: 1, windowMs: 60_000 };
    // user:U 直接打满
    expect(check(["user:U"], opts).ok).toBe(true);
    // ip:1 是新 key（剩 1）；user:U 满了，此次应被拒
    const r = check(["ip:1", "user:U"], opts);
    expect(r.ok).toBe(false);
    // 拒绝不应消耗 ip:1 的配额，所以 ip:1 单独还能成功一次
    const r2 = check(["ip:1"], opts);
    expect(r2.ok).toBe(true);
  });

  it("retryAfterSec 至少 1 秒", () => {
    const opts = { bucket: "x", limit: 1, windowMs: 60_000 };
    check(["ip:1"], opts);
    const r = check(["ip:1"], opts);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(r.retryAfterSec).toBeLessThanOrEqual(60);
  });
});
