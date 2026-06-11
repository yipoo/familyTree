import { describe, expect, it } from "vitest";

import {
  computeWufu,
  type WufuMarriage,
  type WufuParentChild,
  type WufuPerson,
} from "@/lib/services/wufu";

// 构造一个本宗小族（直系 5 代 + 兄弟/伯父/堂兄弟/侄 + 妻/母）
const persons: WufuPerson[] = [
  { id: "gaozu", name: "高祖", gender: "MALE" },
  { id: "zengzu", name: "曾祖", gender: "MALE" },
  { id: "zu", name: "祖父", gender: "MALE" },
  { id: "fu", name: "父", gender: "MALE" },
  { id: "bo", name: "伯", gender: "MALE", birthYear: 1915 }, // 父之兄
  { id: "ji", name: "己", gender: "MALE", birthYear: 1950 },
  { id: "xiong", name: "兄", gender: "MALE", birthYear: 1945 },
  { id: "di", name: "弟", gender: "MALE", birthYear: 1955 },
  { id: "tang", name: "堂兄", gender: "MALE", birthYear: 1948 },
  { id: "zi", name: "子", gender: "MALE" },
  { id: "sun", name: "孙", gender: "MALE" },
  { id: "zengsun", name: "曾孙", gender: "MALE" },
  { id: "xuansun", name: "玄孙", gender: "MALE" },
  { id: "zhi", name: "侄", gender: "MALE" }, // 兄之子
  { id: "qi", name: "妻", gender: "FEMALE" },
  { id: "mu", name: "母", gender: "FEMALE" },
];

const parentChild: WufuParentChild[] = [
  { parentId: "gaozu", childId: "zengzu" },
  { parentId: "zengzu", childId: "zu" },
  { parentId: "zu", childId: "fu" },
  { parentId: "zu", childId: "bo" },
  { parentId: "fu", childId: "ji" },
  { parentId: "fu", childId: "xiong" },
  { parentId: "fu", childId: "di" },
  { parentId: "bo", childId: "tang" },
  { parentId: "ji", childId: "zi" },
  { parentId: "zi", childId: "sun" },
  { parentId: "sun", childId: "zengsun" },
  { parentId: "zengsun", childId: "xuansun" },
  { parentId: "xiong", childId: "zhi" },
];

const marriages: WufuMarriage[] = [
  { husbandId: "ji", wifeId: "qi" },
  { husbandId: "fu", wifeId: "mu" },
];

function build() {
  const chart = computeWufu({ rootPersonId: "ji", persons, parentChild, marriages });
  expect(chart).not.toBeNull();
  const flat = chart!.generations.flatMap((g) => g.members);
  const by = (id: string) => flat.find((m) => m.personId === id)!;
  return { chart: chart!, by };
}

describe("computeWufu — 本宗五服服制", () => {
  it("直系尊亲：父=斩衰、祖=齐衰、曾祖=齐衰、高祖=缌麻", () => {
    const { by } = build();
    expect(by("fu").grade).toBe("斩衰");
    expect(by("zu").grade).toBe("齐衰");
    expect(by("zengzu").grade).toBe("齐衰");
    expect(by("gaozu").grade).toBe("缌麻");
  });

  it("直系卑亲：子=齐衰、孙=大功、曾孙=缌麻、玄孙=缌麻", () => {
    const { by } = build();
    expect(by("zi").grade).toBe("齐衰");
    expect(by("sun").grade).toBe("大功");
    expect(by("zengsun").grade).toBe("缌麻");
    expect(by("xuansun").grade).toBe("缌麻");
  });

  it("旁系：兄弟=齐衰、伯父=齐衰、堂兄弟=大功、侄=大功", () => {
    const { by } = build();
    expect(by("xiong").grade).toBe("齐衰");
    expect(by("bo").grade).toBe("齐衰");
    expect(by("tang").grade).toBe("大功");
    expect(by("zhi").grade).toBe("大功");
  });

  it("称谓：长幼/伯叔区分，己为己", () => {
    const { by } = build();
    expect(by("ji").isSelf).toBe(true);
    expect(by("ji").grade).toBeNull();
    expect(by("xiong").term).toBe("兄"); // 1945 < 1950
    expect(by("di").term).toBe("弟"); // 1955 > 1950
    expect(by("bo").term).toBe("伯父"); // 1915，年长于父
    expect(by("tang").term).toBe("堂兄"); // 1948 < 1950
  });

  it("配偶：己之妻=妻、父之妻=母，服随夫", () => {
    const { by } = build();
    expect(by("qi").term).toBe("妻");
    expect(by("qi").isSpouse).toBe(true);
    expect(by("mu").term).toBe("母");
    expect(by("mu").grade).toBe("斩衰"); // 随父
  });

  it("族外不入：女系外亲不计入本宗", () => {
    // 给兄之女嫁出、其夫与子均不应进入己的本宗五服
    const ps: WufuPerson[] = [
      ...persons,
      { id: "waisun", name: "外孙", gender: "MALE" }, // 己之女的儿子
      { id: "nv", name: "女", gender: "FEMALE" },
      { id: "xu", name: "婿", gender: "MALE" },
    ];
    const pc: WufuParentChild[] = [
      ...parentChild,
      { parentId: "ji", childId: "nv" },
      { parentId: "xu", childId: "waisun" }, // 外孙父系是婿，不通己
    ];
    const ms: WufuMarriage[] = [...marriages, { husbandId: "xu", wifeId: "nv" }];
    const chart = computeWufu({ rootPersonId: "ji", persons: ps, parentChild: pc, marriages: ms });
    const flat = chart!.generations.flatMap((g) => g.members);
    expect(flat.find((m) => m.personId === "nv")).toBeTruthy(); // 女在本宗
    expect(flat.find((m) => m.personId === "waisun")).toBeFalsy(); // 外孙不在
    expect(flat.find((m) => m.personId === "xu")?.isSpouse ?? false).toBe(true); // 婿仅作女之配偶
  });

  it("counts 汇总各服人数", () => {
    const { chart } = build();
    const sum =
      chart.counts.斩衰 + chart.counts.齐衰 + chart.counts.大功 + chart.counts.小功 + chart.counts.缌麻;
    expect(sum).toBeGreaterThan(0);
    expect(chart.counts.斩衰).toBe(2); // 父 + 母(随父)
  });
});
