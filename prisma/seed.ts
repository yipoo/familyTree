/**
 * 丁氏家族 demo seed
 * 数据来源：docs/详细图.pdf（十七世训贤支，从17世到22世）
 *           docs/吊线图.pdf（地点与迁徙）
 *
 * 字辈序列（部分已知）：... 良(15) 允(16) 贤(17) 方(18) 正(19) 维(20) 先(21) 克(22)
 *
 * **重要：本脚本永远只写入 DATABASE_URL_DEMO 指向的库。**
 * 这是为了防止误在生产跑时把所有真实用户和家族 deleteMany 掉。
 * 如未配置 DATABASE_URL_DEMO，脚本直接退出。
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  Gender,
  MarriageType,
  ParentRelation,
  FamilyRole,
  LifeStatus,
  MigrationScope,
} from "../lib/generated/prisma/enums";

const demoUrl = process.env.DATABASE_URL_DEMO;
if (!demoUrl) {
  console.error(
    "❌ DATABASE_URL_DEMO 未配置。\n" +
      "   seed 只能写 demo 库，拒绝执行。请先在 .env 中设置 DATABASE_URL_DEMO，例如：\n" +
      "     DATABASE_URL_DEMO=\"postgresql://user:pass@localhost:5432/family_tree_demo\"\n" +
      "   然后运行：\n" +
      "     pnpm db:demo:reset",
  );
  process.exit(1);
}
if (demoUrl === process.env.DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL_DEMO 与 DATABASE_URL 指向同一个库，拒绝执行。\n" +
      "   demo 必须使用独立 database（可同实例）。",
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: demoUrl });
const prisma = new PrismaClient({ adapter });

// ------------------------------------------------------------
// 字辈表（仅录入已知部分；管理员后续可补全 1–14 世）
// ------------------------------------------------------------
const GENERATION_NAMES: Array<[number, string]> = [
  [15, "良"],
  [16, "允"],
  [17, "贤"],
  [18, "方"],
  [19, "正"],
  [20, "维"],
  [21, "先"],
  [22, "克"],
];

async function main() {
  console.log("🌱 Seeding 丁氏家族 demo data ...");

  // 清空旧 demo 数据（按依赖反向）
  await prisma.migration.deleteMany();
  await prisma.personLocation.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.marriage.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.person.deleteMany();
  await prisma.location.deleteMany();
  await prisma.generationName.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();

  // ---------- 用户 ----------
  const owner = await prisma.user.create({
    data: {
      email: "demo@family.local",
      name: "丁氏 demo Owner",
    },
  });

  // ---------- 家族 ----------
  const family = await prisma.family.create({
    data: {
      surname: "丁",
      name: "丁氏家族",
      founderName: "（始祖待录入）",
      description: "濉溪县南坪镇丁氏一支 demo 数据",
      ownerId: owner.id,
    },
  });

  await prisma.familyMember.create({
    data: {
      userId: owner.id,
      familyId: family.id,
      role: FamilyRole.OWNER,
    },
  });

  // ---------- 字辈表 ----------
  for (const [gen, ch] of GENERATION_NAMES) {
    await prisma.generationName.create({
      data: { familyId: family.id, generation: gen, character: ch },
    });
  }

  // ---------- 地点 ----------
  const locDingHetao = await prisma.location.create({
    data: {
      province: "安徽省",
      city: "淮北市",
      county: "濉溪县",
      town: "南坪镇",
      village: "丁河套",
      fullText: "安徽省淮北市濉溪县南坪镇丁河套",
    },
  });
  const locZhangPaifang = await prisma.location.create({
    data: {
      province: "安徽省",
      city: "淮北市",
      county: "濉溪县",
      town: "南坪镇",
      village: "张牌坊",
      fullText: "安徽省淮北市濉溪县南坪镇张牌坊",
    },
  });
  const locZhangPaifangNew = await prisma.location.create({
    data: {
      province: "安徽省",
      city: "淮北市",
      county: "濉溪县",
      town: "南坪镇",
      village: "张牌坊新村",
      detail: "南坪街西南",
      fullText: "安徽省淮北市濉溪县南坪镇张牌坊新村（南坪街西南）",
    },
  });

  // ---------- 人物创建辅助 ----------
  const charOf = (g: number) => GENERATION_NAMES.find(([k]) => k === g)?.[1];

  async function addPerson(opts: {
    name: string;
    gender: Gender;
    generation: number;
    surnameOnly?: boolean;
    isMarriedIn?: boolean;
    status?: LifeStatus;
    branchId?: string | null;
    alias?: string;
    birthYear?: number;
    deathYear?: number;
    biography?: string;
  }) {
    return prisma.person.create({
      data: {
        familyId: family.id,
        name: opts.name,
        gender: opts.gender,
        generation: opts.generation,
        generationChar: charOf(opts.generation),
        surnameOnly: opts.surnameOnly ?? false,
        isMarriedIn: opts.isMarriedIn ?? false,
        status: opts.status ?? LifeStatus.ALIVE,
        branchId: opts.branchId ?? null,
        alias: opts.alias,
        birthYear: opts.birthYear,
        deathYear: opts.deathYear,
        biography: opts.biography,
      },
    });
  }

  async function addMarriage(opts: {
    husbandId: string;
    wifeId: string;
    type?: MarriageType;
    order?: number;
  }) {
    return prisma.marriage.create({
      data: {
        familyId: family.id,
        husbandId: opts.husbandId,
        wifeId: opts.wifeId,
        type: opts.type ?? MarriageType.PRIMARY,
        order: opts.order ?? 1,
      },
    });
  }

  async function addParentChild(parentId: string, childId: string, birthOrder: number) {
    return prisma.parentChild.create({
      data: {
        familyId: family.id,
        parentId,
        childId,
        relation: ParentRelation.BIOLOGICAL,
        birthOrder,
        isPrimary: true,
      },
    });
  }

  /**
   * 一个家庭单元：父 + 母（可多个） + 子女（按出生顺序）
   * 返回所有创建的子女，便于继续向下展开
   */
  type WifeOpt = {
    name: string;
    surnameOnly?: boolean;
    type?: MarriageType;
    status?: LifeStatus;
    alias?: string;
    birthYear?: number;
    deathYear?: number;
    biography?: string;
  };
  type ChildOpt = {
    name: string;
    gender: Gender;
    status?: LifeStatus;
    alias?: string;
    birthYear?: number;
    deathYear?: number;
    biography?: string;
  };

  async function addFamilyUnit(opts: {
    husbandId: string;
    wives: WifeOpt[];
    children: ChildOpt[];
    childGeneration: number;
    childMotherIndex?: number; // 子女归属于第几位妻子（默认 0 = 原配）
    branchId?: string;
  }): Promise<Record<string, string>> {
    // 创建妻子
    const wifeIds: string[] = [];
    for (let i = 0; i < opts.wives.length; i++) {
      const w = opts.wives[i];
      const wife = await addPerson({
        name: w.name,
        gender: Gender.FEMALE,
        generation: opts.childGeneration - 1,
        surnameOnly: w.surnameOnly ?? true,
        isMarriedIn: true,
        status: w.status,
        branchId: opts.branchId,
        alias: w.alias,
        birthYear: w.birthYear,
        deathYear: w.deathYear,
        biography: w.biography,
      });
      wifeIds.push(wife.id);
      await addMarriage({
        husbandId: opts.husbandId,
        wifeId: wife.id,
        type: w.type ?? (i === 0 ? MarriageType.PRIMARY : MarriageType.SECONDARY),
        order: i + 1,
      });
    }

    // 创建子女
    const motherIdx = opts.childMotherIndex ?? 0;
    const motherId = wifeIds[motherIdx];
    const result: Record<string, string> = {};
    for (let i = 0; i < opts.children.length; i++) {
      const c = opts.children[i];
      const child = await addPerson({
        name: c.name,
        gender: c.gender,
        generation: opts.childGeneration,
        status: c.status,
        branchId: opts.branchId,
        alias: c.alias,
        birthYear: c.birthYear,
        deathYear: c.deathYear,
        biography: c.biography,
      });
      result[c.name] = child.id;
      await addParentChild(opts.husbandId, child.id, i + 1);
      if (motherId) await addParentChild(motherId, child.id, i + 1);
    }
    return result;
  }

  // ============================================================
  // 17世：训贤（支系根）
  // ============================================================
  const xunxian = await addPerson({
    name: "训贤",
    gender: Gender.MALE,
    generation: 17,
    alias: "雅之",
    birthYear: 1898,
    deathYear: 1972,
    status: LifeStatus.DECEASED,
    biography:
      "生于光绪二十四年。1927 年因家族分居，自丁河套迁至张牌坊立户，是十七世训贤支始祖。务农一生，育有四子。",
  });

  // 创建支系
  const branch = await prisma.branch.create({
    data: {
      familyId: family.id,
      name: "十七世训贤支",
      rootPersonId: xunxian.id,
      locationId: locZhangPaifangNew.id,
      description: "濉溪县南坪镇张牌坊新村（南坪街西南）",
    },
  });

  // 把训贤挂到支系
  await prisma.person.update({
    where: { id: xunxian.id },
    data: { branchId: branch.id },
  });

  // 支系级迁徙史
  await prisma.migration.create({
    data: {
      familyId: family.id,
      scope: MigrationScope.BRANCH,
      branchId: branch.id,
      year: 1927,
      fromLocationId: locDingHetao.id,
      toLocationId: locZhangPaifang.id,
      reason: "分居",
      note: "1927 年因分居由丁河套迁至张牌坊",
    },
  });
  await prisma.migration.create({
    data: {
      familyId: family.id,
      scope: MigrationScope.BRANCH,
      branchId: branch.id,
      year: 2022,
      fromLocationId: locZhangPaifang.id,
      toLocationId: locZhangPaifangNew.id,
      reason: "塌陷",
      note: "2022 年因塌陷迁至张牌坊新村",
    },
  });

  // 17世训贤 配 卞氏 子四
  const gen18 = await addFamilyUnit({
    husbandId: xunxian.id,
    wives: [
      {
        name: "卞氏",
        birthYear: 1902,
        deathYear: 1968,
        status: LifeStatus.DECEASED,
        biography: "出生于濉溪本地卞家庄，与训贤公育有四子。一生勤俭，操持家务。",
      },
    ],
    children: [
      {
        name: "方儒",
        gender: Gender.MALE,
        alias: "学斋",
        birthYear: 1924,
        deathYear: 2003,
        status: LifeStatus.DECEASED,
        biography:
          "训贤公长子。少时入私塾，写得一手好字。1949 年后任村会计，育有正华、正中。",
      },
      {
        name: "方祥",
        gender: Gender.MALE,
        birthYear: 1928,
        deathYear: 2011,
        status: LifeStatus.DECEASED,
      },
      {
        name: "方明",
        gender: Gender.MALE,
        birthYear: 1931,
        deathYear: 2018,
        status: LifeStatus.DECEASED,
      },
      {
        name: "方亮",
        gender: Gender.MALE,
        birthYear: 1936,
        status: LifeStatus.ALIVE,
      },
    ],
    childGeneration: 18,
    branchId: branch.id,
  });

  // ============================================================
  // 18 世
  // ============================================================
  const gen19_ru = await addFamilyUnit({
    husbandId: gen18["方儒"],
    wives: [{ name: "刘氏" }],
    children: [
      { name: "正华", gender: Gender.MALE },
      { name: "正中", gender: Gender.MALE },
    ],
    childGeneration: 19,
    branchId: branch.id,
  });

  const gen19_xiang = await addFamilyUnit({
    husbandId: gen18["方祥"],
    wives: [{ name: "吴氏" }],
    children: [{ name: "正品", gender: Gender.MALE }],
    childGeneration: 19,
    branchId: branch.id,
  });

  const gen19_ming = await addFamilyUnit({
    husbandId: gen18["方明"],
    wives: [{ name: "宋氏" }],
    children: [{ name: "正义", gender: Gender.MALE }],
    childGeneration: 19,
    branchId: branch.id,
  });

  const gen19_liang = await addFamilyUnit({
    husbandId: gen18["方亮"],
    wives: [{ name: "胡志英", surnameOnly: false }],
    children: [{ name: "正伟", gender: Gender.MALE }],
    childGeneration: 19,
    branchId: branch.id,
  });

  // ============================================================
  // 19 世
  // ============================================================
  const gen20_hua = await addFamilyUnit({
    husbandId: gen19_ru["正华"],
    wives: [{ name: "张绍英", surnameOnly: false }],
    children: [{ name: "维仁", gender: Gender.MALE }],
    childGeneration: 20,
    branchId: branch.id,
  });

  // 正中：原配张道侠（已故），子一维龙；继妻卞爱莲
  const gen20_zhong = await addFamilyUnit({
    husbandId: gen19_ru["正中"],
    wives: [
      {
        name: "张道侠",
        surnameOnly: false,
        status: LifeStatus.DECEASED,
        birthYear: 1962,
        deathYear: 1995,
        biography:
          "正中公原配。与正中公育有维龙。1995 年因病早逝，年仅 33 岁。",
      },
      {
        name: "卞爱莲",
        surnameOnly: false,
        type: MarriageType.SECONDARY,
        birthYear: 1965,
        biography: "正中公继配，无所出，悉心抚育维龙长大。",
      },
    ],
    children: [
      {
        name: "维龙",
        gender: Gender.MALE,
        birthYear: 1988,
        biography: "正中公长子，自幼随继母长大。现在县城从事建材生意。",
      },
    ],
    childGeneration: 20,
    childMotherIndex: 0, // 维龙是张道侠所出
    branchId: branch.id,
  });

  const gen20_pin = await addFamilyUnit({
    husbandId: gen19_xiang["正品"],
    wives: [{ name: "张广云", surnameOnly: false }],
    children: [
      { name: "维化", gender: Gender.MALE },
      { name: "维海", gender: Gender.MALE },
      { name: "维洲", gender: Gender.MALE },
    ],
    childGeneration: 20,
    branchId: branch.id,
  });

  const gen20_yi = await addFamilyUnit({
    husbandId: gen19_ming["正义"],
    wives: [{ name: "王树兰", surnameOnly: false }],
    children: [
      { name: "维才", gender: Gender.MALE },
      { name: "维生", gender: Gender.MALE },
    ],
    childGeneration: 20,
    branchId: branch.id,
  });

  const gen20_wei = await addFamilyUnit({
    husbandId: gen19_liang["正伟"],
    wives: [{ name: "孙明亚", surnameOnly: false }],
    children: [{ name: "宁", gender: Gender.MALE }],
    childGeneration: 20,
    branchId: branch.id,
  });

  // ============================================================
  // 20 世
  // ============================================================
  const gen21_ren = await addFamilyUnit({
    husbandId: gen20_hua["维仁"],
    wives: [{ name: "姜莉", surnameOnly: false }],
    children: [
      { name: "悦", gender: Gender.FEMALE },
      { name: "浩", gender: Gender.MALE },
    ],
    childGeneration: 21,
    branchId: branch.id,
  });

  const gen21_long = await addFamilyUnit({
    husbandId: gen20_zhong["维龙"],
    wives: [{ name: "杨建芹", surnameOnly: false }],
    children: [{ name: "洋", gender: Gender.MALE }],
    childGeneration: 21,
    branchId: branch.id,
  });

  const gen21_hua2 = await addFamilyUnit({
    husbandId: gen20_pin["维化"],
    wives: [{ name: "王玲玲", surnameOnly: false }],
    children: [
      { name: "军", gender: Gender.MALE },
      { name: "盼", gender: Gender.FEMALE },
    ],
    childGeneration: 21,
    branchId: branch.id,
  });

  const gen21_hai = await addFamilyUnit({
    husbandId: gen20_pin["维海"],
    wives: [{ name: "许英", surnameOnly: false }],
    children: [
      { name: "先瑞", gender: Gender.MALE },
      { name: "艳", gender: Gender.FEMALE },
    ],
    childGeneration: 21,
    branchId: branch.id,
  });

  await addFamilyUnit({
    husbandId: gen20_pin["维洲"],
    wives: [{ name: "肖华玲", surnameOnly: false }],
    children: [
      { name: "瑞", gender: Gender.FEMALE },
      { name: "娜", gender: Gender.FEMALE },
    ],
    childGeneration: 21,
    branchId: branch.id,
  });

  const gen21_cai = await addFamilyUnit({
    husbandId: gen20_yi["维才"],
    wives: [{ name: "张存玲", surnameOnly: false }],
    children: [
      { name: "振航", gender: Gender.MALE },
      { name: "振宇", gender: Gender.MALE },
    ],
    childGeneration: 21,
    branchId: branch.id,
  });

  const gen21_sheng = await addFamilyUnit({
    husbandId: gen20_yi["维生"],
    wives: [{ name: "李贞", surnameOnly: false }],
    children: [{ name: "湛依", gender: Gender.FEMALE }],
    childGeneration: 21,
    branchId: branch.id,
  });

  // 宁（维）—— 20世，孙明亚之子，无配偶/子女记录
  void gen20_wei;
  void gen21_cai;
  void gen21_sheng;

  // ============================================================
  // 21 世
  // ============================================================
  await addFamilyUnit({
    husbandId: gen21_ren["浩"],
    wives: [{ name: "朱小妹", surnameOnly: false }],
    children: [
      { name: "语晨", gender: Gender.FEMALE },
      { name: "欣如", gender: Gender.FEMALE },
      { name: "宇泽", gender: Gender.MALE },
    ],
    childGeneration: 22,
    branchId: branch.id,
  });

  await addFamilyUnit({
    husbandId: gen21_long["洋"],
    wives: [{ name: "夏冰冰", surnameOnly: false }],
    children: [{ name: "黎", gender: Gender.FEMALE }],
    childGeneration: 22,
    branchId: branch.id,
  });

  await addFamilyUnit({
    husbandId: gen21_hua2["军"],
    wives: [{ name: "蒋云", surnameOnly: false }],
    children: [
      { name: "兴旺", gender: Gender.MALE },
      { name: "兴隆", gender: Gender.MALE },
    ],
    childGeneration: 22,
    branchId: branch.id,
  });

  await addFamilyUnit({
    husbandId: gen21_hai["先瑞"],
    wives: [{ name: "魏莹莹", surnameOnly: false }],
    children: [
      { name: "烁", gender: Gender.MALE },
      { name: "欣", gender: Gender.FEMALE },
    ],
    childGeneration: 22,
    branchId: branch.id,
  });

  // ---------- 完成 ----------
  const stats = await prisma.person.groupBy({
    by: ["gender"],
    where: { familyId: family.id },
    _count: true,
  });
  const total = stats.reduce((s, r) => s + r._count, 0);
  console.log(`✅ Seed 完成：family=${family.id}`);
  console.log(`   总人数 ${total}：`, stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
