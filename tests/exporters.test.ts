import { describe, expect, it } from "vitest";

import {
  toCsvBundle,
  toGedcom,
  toJson,
  type ExportSnapshot,
} from "@/lib/services/exporters";

const SNAP: ExportSnapshot = {
  family: {
    id: "f1",
    surname: "丁",
    name: "丁氏家族",
    description: null,
    founderName: "丁老",
  },
  generationNames: [
    { generation: 1, character: "天" },
    { generation: 2, character: "地" },
  ],
  persons: [
    {
      id: "p1",
      externalId: "1",
      name: "丁老",
      alias: null,
      gender: "MALE",
      generation: 1,
      generationChar: "天",
      birthOrder: 1,
      birthYear: 1900,
      deathYear: 1980,
      birthDate: null,
      deathDate: null,
      birthPlace: "丁庄",
      status: "DECEASED",
      isMarriedIn: false,
      succession: null,
      paperRecord: null,
      biography: "传奇一生",
      noteHint: null,
    },
    {
      id: "p2",
      externalId: "2",
      name: "丁二",
      alias: "二郎",
      gender: "MALE",
      generation: 2,
      generationChar: "地",
      birthOrder: 1,
      birthYear: 1925,
      deathYear: null,
      birthDate: null,
      deathDate: null,
      birthPlace: null,
      status: "ALIVE",
      isMarriedIn: false,
      succession: null,
      paperRecord: null,
      biography: null,
      noteHint: null,
    },
    {
      id: "w1",
      externalId: null,
      name: "李氏",
      alias: null,
      gender: "FEMALE",
      generation: 1,
      generationChar: null,
      birthOrder: null,
      birthYear: null,
      deathYear: null,
      birthDate: null,
      deathDate: null,
      birthPlace: null,
      status: "UNKNOWN",
      isMarriedIn: true,
      succession: null,
      paperRecord: null,
      biography: null,
      noteHint: null,
    },
  ],
  marriages: [
    {
      id: "m1",
      husbandId: "p1",
      wifeId: "w1",
      type: "PRIMARY",
      order: 1,
      marriedYear: 1920,
      endedYear: null,
    },
  ],
  parentChild: [
    {
      id: "pc1",
      parentId: "p1",
      childId: "p2",
      relation: "BIOLOGICAL",
      birthOrder: 1,
      isPrimary: true,
    },
  ],
  generatedAt: "2026-05-05T00:00:00Z",
};

describe("toJson", () => {
  it("可以反序列化回原结构", () => {
    const s = toJson(SNAP);
    const parsed = JSON.parse(s);
    expect(parsed.family.surname).toBe("丁");
    expect(parsed.persons.length).toBe(3);
  });
});

describe("toCsvBundle", () => {
  const out = toCsvBundle(SNAP);

  it("persons 包含表头和每行", () => {
    const lines = out.persons.split("\n");
    expect(lines[0]).toContain("name");
    expect(lines.length).toBe(SNAP.persons.length + 1);
  });

  it("逗号 / 引号 / 换行被转义", () => {
    const tricky: ExportSnapshot = {
      ...SNAP,
      persons: [
        {
          ...SNAP.persons[0],
          biography: '一生" 含,逗\n号',
          name: '王"二',
        },
      ],
    };
    const tOut = toCsvBundle(tricky);
    expect(tOut.persons).toContain('"王""二"');
    expect(tOut.persons).toContain('"一生"" 含,逗');
  });

  it("marriages 与 parentChild 表头与行数正确", () => {
    expect(out.marriages.split("\n").length).toBe(SNAP.marriages.length + 1);
    expect(out.parentChild.split("\n").length).toBe(SNAP.parentChild.length + 1);
    expect(out.generationNames.split("\n").length).toBe(
      SNAP.generationNames.length + 1,
    );
  });
});

describe("toGedcom", () => {
  const ged = toGedcom(SNAP);

  it("包含 GEDCOM 5.5.1 标准头", () => {
    expect(ged).toContain("0 HEAD");
    expect(ged).toContain("2 VERS 5.5.1");
    expect(ged).toContain("0 TRLR");
  });

  it("每个人物有 INDI 节并含 SEX", () => {
    const indis = ged.match(/0 @I\d+@ INDI/g) ?? [];
    expect(indis.length).toBe(SNAP.persons.length);
    expect(ged).toContain("1 SEX M");
    expect(ged).toContain("1 SEX F");
  });

  it("INDI 块内包含 BIRT/DEAT 信息", () => {
    expect(ged).toContain("1 BIRT");
    expect(ged).toContain("2 DATE 1900");
    expect(ged).toContain("1 DEAT");
    expect(ged).toContain("2 DATE 1980");
  });

  it("FAM 节包含 HUSB/WIFE/CHIL 三类引用", () => {
    expect(ged).toMatch(/0 @F\d+@ FAM/);
    expect(ged).toMatch(/1 HUSB @I\d+@/);
    expect(ged).toMatch(/1 WIFE @I\d+@/);
    expect(ged).toMatch(/1 CHIL @I\d+@/);
  });
});
