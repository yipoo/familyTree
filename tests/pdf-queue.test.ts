/**
 * pdf-queue 的可单测部分。
 *
 * 真正的渲染流程依赖 prisma + react-pdf，不在单测里覆盖；这里只验：
 *   - SYNC_PERSON_THRESHOLD 是 number 且大于 0
 *   - _resetQueueForTest 不抛错（让 in-memory 状态可清）
 *
 * 渲染路径在 build / dev 起来时手动验证，详见 docs/deploy.md PDF 章节。
 */
import { describe, expect, it } from "vitest";

import { _resetQueueForTest, SYNC_PERSON_THRESHOLD } from "@/lib/services/pdf-queue";

describe("pdf-queue 公共接口", () => {
  it("阈值是合理的正整数", () => {
    expect(typeof SYNC_PERSON_THRESHOLD).toBe("number");
    expect(SYNC_PERSON_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(SYNC_PERSON_THRESHOLD)).toBe(true);
  });

  it("_resetQueueForTest 可重复调用", () => {
    expect(() => _resetQueueForTest()).not.toThrow();
    expect(() => _resetQueueForTest()).not.toThrow();
  });
});
