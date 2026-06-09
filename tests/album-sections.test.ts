import { describe, expect, it } from "vitest";

import {
  defaultAlbumSections,
  resolveAlbumSections,
  defaultTitleForKind,
  isSystemKind,
  isCustomKind,
  canDeleteKind,
  isInsertableKind,
  defaultSectionCreateData,
  type AlbumSectionRow,
} from "@/lib/services/album-sections";
import { AlbumSectionKind } from "@/lib/generated/prisma/enums";

function row(
  id: string,
  kind: AlbumSectionKind,
  order: number,
  over: Partial<AlbumSectionRow> = {},
): AlbumSectionRow {
  return {
    id,
    kind,
    title: null,
    subtitle: null,
    body: null,
    signature: null,
    imageUrl: null,
    order,
    enabled: true,
    appliesTo: [],
    ...over,
  };
}

describe("defaultAlbumSections", () => {
  it("顺序严格对齐改造前合编本", () => {
    expect(defaultAlbumSections().map((s) => s.kind)).toEqual([
      AlbumSectionKind.FANLI,
      AlbumSectionKind.PREFACE,
      AlbumSectionKind.YUANLIU,
      AlbumSectionKind.ZIBEI,
      AlbumSectionKind.RULES,
      AlbumSectionKind.COMPILERS,
      AlbumSectionKind.TULU,
      AlbumSectionKind.PORTRAITS,
      AlbumSectionKind.POSTSCRIPT,
    ]);
  });

  it("默认项 id/body 为 null、enabled、order 递增", () => {
    defaultAlbumSections().forEach((s, i) => {
      expect(s.id).toBeNull();
      expect(s.body).toBeNull();
      expect(s.enabled).toBe(true);
      expect(s.order).toBe(i);
    });
  });
});

describe("resolveAlbumSections", () => {
  it("空 / null → 默认列表（9 节）", () => {
    expect(resolveAlbumSections([]).map((s) => s.kind)).toEqual(
      defaultAlbumSections().map((s) => s.kind),
    );
    expect(resolveAlbumSections(null)).toHaveLength(9);
    expect(resolveAlbumSections(undefined)).toHaveLength(9);
  });

  it("有记录 → 按 order 升序，丢弃默认", () => {
    const rows = [
      row("b", AlbumSectionKind.POSTSCRIPT, 2),
      row("a", AlbumSectionKind.FANLI, 0),
      row("c", AlbumSectionKind.CUSTOM_TEXT, 1),
    ];
    expect(resolveAlbumSections(rows).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("保留 enabled=false（不在解析层过滤）", () => {
    const rows = [row("x", AlbumSectionKind.FANLI, 0, { enabled: false })];
    const r = resolveAlbumSections(rows);
    expect(r).toHaveLength(1);
    expect(r[0].enabled).toBe(false);
  });
});

describe("分类与默认标题", () => {
  it("isSystemKind", () => {
    expect(isSystemKind(AlbumSectionKind.TULU)).toBe(true);
    expect(isSystemKind(AlbumSectionKind.PORTRAITS)).toBe(true);
    expect(isSystemKind(AlbumSectionKind.FANLI)).toBe(false);
  });

  it("isCustomKind / canDeleteKind：仅自定义可删", () => {
    expect(isCustomKind(AlbumSectionKind.CUSTOM_IMAGE)).toBe(true);
    expect(canDeleteKind(AlbumSectionKind.CUSTOM_TEXT)).toBe(true);
    expect(canDeleteKind(AlbumSectionKind.FANLI)).toBe(false);
    expect(canDeleteKind(AlbumSectionKind.TULU)).toBe(false);
  });

  it("isInsertableKind", () => {
    expect(isInsertableKind(AlbumSectionKind.PREFACE)).toBe(true);
    expect(isInsertableKind(AlbumSectionKind.CUSTOM_TEXT)).toBe(true);
    expect(isInsertableKind(AlbumSectionKind.TULU)).toBe(false);
  });

  it("defaultTitleForKind", () => {
    expect(defaultTitleForKind(AlbumSectionKind.FANLI)).toBe("凡例");
    expect(defaultTitleForKind(AlbumSectionKind.YUANLIU)).toBe("姓氏源流");
    expect(defaultTitleForKind(AlbumSectionKind.POSTSCRIPT)).toBe("跋");
  });
});

describe("defaultSectionCreateData", () => {
  it("带 familyId、与默认列表同序同长度", () => {
    const data = defaultSectionCreateData("fam1");
    expect(data).toHaveLength(9);
    expect(data.every((d) => d.familyId === "fam1")).toBe(true);
    expect(data.map((d) => d.kind)).toEqual(
      defaultAlbumSections().map((s) => s.kind),
    );
  });
});
