import { describe, expect, it } from "vitest";

import { normalizePhone, isValidCnMobile, hashPhone } from "@/lib/services/phone";
import { signToken, verifyToken } from "@/lib/services/miniapp-token";
import { matchPositions, type PositionCandidate } from "@/lib/services/miniapp-bind";

describe("phone normalize/hash", () => {
  it("规范化各种写法到 11 位", () => {
    expect(normalizePhone("138 0013 8000")).toBe("13800138000");
    expect(normalizePhone("+86 13800138000")).toBe("13800138000");
    expect(normalizePhone("8613800138000")).toBe("13800138000");
    expect(normalizePhone("013800138000")).toBe("13800138000");
  });

  it("校验大陆手机号", () => {
    expect(isValidCnMobile("13800138000")).toBe(true);
    expect(isValidCnMobile("+86 139-0000-0000")).toBe(true);
    expect(isValidCnMobile("12345")).toBe(false);
  });

  it("哈希确定且对等价写法一致；太短返回 null", () => {
    const a = hashPhone("13800138000");
    const b = hashPhone("+86 138 0013 8000");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(hashPhone("123")).toBeNull();
  });
});

describe("miniapp token", () => {
  it("签发→校验往返", () => {
    const t = signToken({ openid: "ox123", userId: "u1", kind: "session" }, 3600);
    const c = verifyToken(t);
    expect(c?.openid).toBe("ox123");
    expect(c?.userId).toBe("u1");
    expect(c?.kind).toBe("session");
  });

  it("篡改签名 → null", () => {
    const t = signToken({ openid: "ox123", kind: "bind" }, 3600);
    const tampered = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("过期 → null", () => {
    const t = signToken({ openid: "ox123", kind: "session" }, -10);
    expect(verifyToken(t)).toBeNull();
  });

  it("格式错误 → null", () => {
    expect(verifyToken("not.a.token.x")).toBeNull();
    expect(verifyToken("garbage")).toBeNull();
  });
});

describe("matchPositions（纯自动匹配）", () => {
  const HASH = hashPhone("13800138000")!;
  const candidates: PositionCandidate[] = [
    { familyId: "f1", familyName: "丁氏", personId: "p1", personName: "丁三", generation: 9, contactPhoneHash: HASH },
    { familyId: "f1", familyName: "丁氏", personId: "p1b", personName: "另一个", generation: 9, contactPhoneHash: HASH }, // 同族同哈希
    { familyId: "f2", familyName: "王氏", personId: "p2", personName: "王五", generation: 5, contactPhoneHash: HASH },
    { familyId: "f3", familyName: "李氏", personId: "p3", personName: "李四", generation: 3, contactPhoneHash: hashPhone("13900000000") },
    { familyId: "f4", familyName: "赵氏", personId: "p4", personName: "赵六", generation: 2, contactPhoneHash: null },
  ];

  it("命中跨家族，每家族一个，未命中/空哈希排除", () => {
    const m = matchPositions(candidates, HASH);
    expect(m.map((x) => x.familyId)).toEqual(["f1", "f2"]); // f3 不同号、f4 空，f1 去重
    expect(m.find((x) => x.familyId === "f1")?.personId).toBe("p1"); // 取首个
  });

  it("无命中返回空", () => {
    expect(matchPositions(candidates, hashPhone("15000000000")!)).toEqual([]);
  });
});
