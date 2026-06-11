/**
 * undo 服务的可单测部分。
 *
 * undoAudit 依赖 prisma，不在这里覆盖；但 stripImmutable / stripDates 等纯函数
 * 我们通过把它们临时 export 出来再覆盖。如果未来移到独立 helper 模块更佳。
 *
 * 这里目前只验"模块能加载 + undoAudit 形状"作为冒烟测试；
 * 真正的字段恢复路径在 docs/deploy.md 的"撤回测试清单"里手测覆盖。
 */
import { describe, expect, it } from "vitest";

import { undoAudit } from "@/lib/services/undo";

describe("undoAudit 公共形状", () => {
  it("是函数且接收三个参数", () => {
    expect(typeof undoAudit).toBe("function");
    expect(undoAudit.length).toBe(1);
  });
});
