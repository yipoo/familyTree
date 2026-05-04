/**
 * 从 Excel 导入丁氏家族族谱
 * 文件：docs/丁氏家族族谱成员表格-2026430.xlsx
 *
 * 步骤：
 *  1. 清空所有家族相关数据
 *  2. 创建 owner + family + 字辈表
 *  3. 批量插入 Person（保留 externalId 用于关系映射）
 *  4. 批量插入 ParentChild（来自 父亲ID / 母亲ID）
 *  5. 从 (父亲ID, 母亲ID) 对推导 Marriage
 *
 * 字段取舍：
 *  - 保留：externalId, 姓+名, 别名, 性别, 排行, 生日, 出生地, 字辈,
 *          出承, 是否健在, 个人传记, 线索备注, 纸谱行传
 *  - 跳过：身高, 血型, 遗传病, 电话, 邮箱, 学历, 学校, 单位职务,
 *          字, 号, 谥号, 忌日, 享年, 过逝地点, 安葬地点, 现居地, 祖籍地, 标记, 婚配
 *    （以上字段在样本中绝大多数为空，或属于敏感隐私，本次不导入）
 */
import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Gender, LifeStatus, MarriageType, ParentRelation, FamilyRole } from "../lib/generated/prisma/enums";

const FILE = path.resolve(process.cwd(), "docs/丁氏家族族谱成员表格-2026430.xlsx");
const BATCH = 500;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// "第17世" -> 17
function parseGeneration(s: string): number | null {
  const m = s?.match(/第\s*([0-9一二三四五六七八九十百零]+)\s*世/);
  if (!m) return null;
  const raw = m[1];
  const n = Number(raw);
  if (!Number.isNaN(n)) return n;
  // 中文数字简单解析（足以应付 1-99）
  const digits: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9,
  };
  let total = 0;
  let cur = 0;
  for (const ch of raw) {
    if (ch === "十") {
      total += (cur || 1) * 10;
      cur = 0;
    } else if (ch === "百") {
      total += (cur || 1) * 100;
      cur = 0;
    } else if (digits[ch] !== undefined) {
      cur = digits[ch];
    }
  }
  total += cur;
  return total || null;
}

function parseGender(s: string): Gender {
  if (s === "男") return Gender.MALE;
  if (s === "女") return Gender.FEMALE;
  return Gender.UNKNOWN;
}

function parseAlive(s: string): LifeStatus {
  if (s === "否") return LifeStatus.DECEASED;
  if (s === "是") return LifeStatus.ALIVE;
  return LifeStatus.UNKNOWN;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if ("text" in v && typeof (v as { text: unknown }).text === "string") {
      return ((v as { text: string }).text).trim();
    }
    if ("result" in v) return cellText((v as { result: ExcelJS.CellValue }).result);
    if ("richText" in v) {
      return ((v as { richText: { text: string }[] }).richText)
        .map((r) => r.text)
        .join("")
        .trim();
    }
  }
  return String(v).trim();
}

interface RawPerson {
  externalId: string;
  generation: number;
  surname: string;
  givenName: string;
  alias: string;
  gender: Gender;
  birthOrder: number | null;
  birthDate: string;
  birthPlace: string;
  generationChar: string;
  succession: string;
  status: LifeStatus;
  paperRecord: string;
  noteHint: string;
  biography: string;
  fatherExternalId: string;
  motherExternalId: string;
  motherName: string;
}

async function readExcel(): Promise<RawPerson[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];

  const headers: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    headers.push(cellText(ws.getRow(1).getCell(c).value));
  }
  const idx = (name: string) => headers.indexOf(name) + 1;

  // ⚠️ 该 Excel 的列标题"父亲/父亲ID"与"母亲/母亲ID"实际与数据列错位：
  //   位置 5 实为 父亲ID（数字），位置 6 实为 父亲（姓名）；
  //   位置 7 实为 母亲ID（数字），位置 8 实为 母亲（姓名）。
  // 因此这里按位置硬编码，不依赖 idx("父亲ID")。
  const cols = {
    gen: idx("世系"),
    id: idx("ID"),
    surname: idx("姓"),
    given: idx("名"),
    fatherId: 5,
    motherId: 7,
    alias: idx("别名"),
    gender: idx("性别"),
    order: idx("排行"),
    birth: idx("生日"),
    birthPlace: idx("出生地"),
    char: idx("字辈"),
    succession: idx("出承"),
    alive: idx("是否健在"),
    paper: idx("纸谱行传"),
    note: idx("线索备注"),
    bio: idx("个人传记"),
  };

  const rows: RawPerson[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (c: number) => cellText(row.getCell(c).value);
    const externalId = get(cols.id);
    if (!externalId) continue;
    const gen = parseGeneration(get(cols.gen));
    if (!gen) continue;

    const orderRaw = get(cols.order);
    const orderNum = orderRaw ? Number(orderRaw) : null;
    const birthOrder = orderNum != null && !Number.isNaN(orderNum) && orderNum > 0 ? orderNum : null;

    rows.push({
      externalId,
      generation: gen,
      surname: get(cols.surname),
      givenName: get(cols.given),
      alias: get(cols.alias),
      gender: parseGender(get(cols.gender)),
      birthOrder,
      birthDate: get(cols.birth),
      birthPlace: get(cols.birthPlace),
      generationChar: get(cols.char),
      succession: get(cols.succession),
      status: parseAlive(get(cols.alive)),
      paperRecord: get(cols.paper),
      noteHint: get(cols.note),
      biography: get(cols.bio),
      fatherExternalId: get(cols.fatherId),
      motherExternalId: get(cols.motherId),
      motherName: get(cols.motherId + 1), // 母亲 name 列（紧邻 母亲ID 列）
    });
  }
  return rows;
}

async function main() {
  console.log("📖 读取 Excel ...");
  const rows = await readExcel();
  console.log(`   共 ${rows.length} 行`);

  console.log("🧹 清空旧数据 ...");
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

  console.log("👤 创建 Owner 与 Family ...");
  const owner = await prisma.user.create({
    data: { email: "demo@family.local", name: "丁氏 demo Owner" },
  });
  const family = await prisma.family.create({
    data: {
      surname: "丁",
      name: "丁氏家族",
      ownerId: owner.id,
      description: "从 Excel 全量导入",
    },
  });
  await prisma.familyMember.create({
    data: { userId: owner.id, familyId: family.id, role: FamilyRole.OWNER },
  });

  // ---------- 字辈表：从 Excel 各代最常见字辈推导 ----------
  console.log("📚 推导字辈表 ...");
  const charByGen = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!r.generationChar) continue;
    const m = charByGen.get(r.generation) ?? new Map<string, number>();
    m.set(r.generationChar, (m.get(r.generationChar) ?? 0) + 1);
    charByGen.set(r.generation, m);
  }
  const generationNames: { generation: number; character: string }[] = [];
  for (const [gen, counts] of charByGen) {
    let best = "";
    let bestN = 0;
    for (const [ch, n] of counts) {
      if (n > bestN) {
        best = ch;
        bestN = n;
      }
    }
    if (best) generationNames.push({ generation: gen, character: best });
  }
  generationNames.sort((a, b) => a.generation - b.generation);
  if (generationNames.length > 0) {
    await prisma.generationName.createMany({
      data: generationNames.map((g) => ({ ...g, familyId: family.id })),
    });
  }
  console.log(`   字辈 ${generationNames.length} 条`);

  // ---------- 合成嫁入母亲（externalId 不在 Person.id 列，但被引用） ----------
  console.log("👰 合成被引用但缺失的母亲（嫁入女性） ...");
  const presentIds = new Set(rows.map((r) => r.externalId));
  // motherExternalId -> { name, generation }（取最小子代-1）
  const synthMothers = new Map<string, { name: string; generation: number }>();
  for (const r of rows) {
    if (!r.motherExternalId) continue;
    if (presentIds.has(r.motherExternalId)) continue; // 已存在
    const motherGen = Math.max(1, r.generation - 1);
    const exist = synthMothers.get(r.motherExternalId);
    if (!exist) {
      synthMothers.set(r.motherExternalId, {
        name: r.motherName || "(佚名氏)",
        generation: motherGen,
      });
    } else if (motherGen < exist.generation) {
      exist.generation = motherGen;
    }
  }
  console.log(`   合成母亲 ${synthMothers.size} 条`);

  // ---------- 批量插入 Person（含合成母亲） ----------
  console.log(`👥 插入 ${rows.length + synthMothers.size} 个人物 ...`);
  // 为每行预先生成 cuid，方便后面建立关系
  // 用 externalId -> cuid 的 map，但 cuid 由 Prisma 默认生成，所以先批量插入再回查
  const personData = [
    ...rows.map((r) => ({
      familyId: family.id,
      externalId: r.externalId,
      name: r.givenName || `${r.surname}${r.givenName}`.trim() || `(无名#${r.externalId})`,
      alias: r.alias || null,
      gender: r.gender,
      generation: r.generation,
      generationChar: r.generationChar || null,
      birthOrder: r.birthOrder,
      birthDate: r.birthDate || null,
      birthPlace: r.birthPlace || null,
      status: r.status,
      succession: r.succession || null,
      paperRecord: r.paperRecord || null,
      noteHint: r.noteHint || null,
      biography: r.biography || null,
      isMarriedIn: false,
      surnameOnly: false as boolean,
    })),
    // 合成母亲
    ...Array.from(synthMothers.entries()).map(([extId, m]) => ({
      familyId: family.id,
      externalId: extId,
      name: m.name,
      alias: null as string | null,
      gender: Gender.FEMALE,
      generation: m.generation,
      generationChar: null as string | null,
      birthOrder: null as number | null,
      birthDate: null as string | null,
      birthPlace: null as string | null,
      status: LifeStatus.UNKNOWN,
      succession: null as string | null,
      paperRecord: null as string | null,
      noteHint: null as string | null,
      biography: null as string | null,
      isMarriedIn: true,
      surnameOnly: /^[一-鿿]氏$/.test(m.name),
    })),
  ];

  for (let i = 0; i < personData.length; i += BATCH) {
    const slice = personData.slice(i, i + BATCH);
    await prisma.person.createMany({ data: slice });
    if ((i / BATCH) % 5 === 0) {
      process.stdout.write(`   ${Math.min(i + BATCH, personData.length)}/${personData.length}\r`);
    }
  }
  process.stdout.write("\n");

  console.log("🔗 构建 externalId → id 映射 ...");
  // 一次性拉取所有 (id, externalId) 对
  const all = await prisma.person.findMany({
    where: { familyId: family.id },
    select: { id: true, externalId: true },
  });
  const idMap = new Map<string, string>();
  for (const p of all) {
    if (p.externalId) idMap.set(p.externalId, p.id);
  }

  // ---------- 批量插入 ParentChild ----------
  console.log("👨‍👩‍👧 插入亲子关系 ...");
  const pcData: {
    familyId: string;
    parentId: string;
    childId: string;
    relation: ParentRelation;
    birthOrder: number | null;
    isPrimary: boolean;
  }[] = [];
  let missingParent = 0;
  for (const r of rows) {
    const childId = idMap.get(r.externalId);
    if (!childId) continue;
    if (r.fatherExternalId) {
      const parentId = idMap.get(r.fatherExternalId);
      if (parentId) {
        pcData.push({
          familyId: family.id,
          parentId,
          childId,
          relation: ParentRelation.BIOLOGICAL,
          birthOrder: r.birthOrder,
          isPrimary: true,
        });
      } else missingParent++;
    }
    if (r.motherExternalId) {
      const parentId = idMap.get(r.motherExternalId);
      if (parentId) {
        pcData.push({
          familyId: family.id,
          parentId,
          childId,
          relation: ParentRelation.BIOLOGICAL,
          birthOrder: r.birthOrder,
          isPrimary: true,
        });
      } else missingParent++;
    }
  }
  // 去重（同 parentId+childId+relation 唯一）
  const pcKey = (x: { parentId: string; childId: string; relation: ParentRelation }) =>
    `${x.parentId}::${x.childId}::${x.relation}`;
  const pcDedup = Array.from(
    new Map(pcData.map((x) => [pcKey(x), x])).values(),
  );
  for (let i = 0; i < pcDedup.length; i += BATCH) {
    const slice = pcDedup.slice(i, i + BATCH);
    await prisma.parentChild.createMany({ data: slice, skipDuplicates: true });
  }
  console.log(`   ${pcDedup.length} 条亲子（缺失父/母 ${missingParent}）`);

  // ---------- 推导 Marriage：从 (fatherId, motherId) 对去重 ----------
  console.log("💍 推导婚姻关系 ...");
  const marriageKeys = new Set<string>();
  const marriages: {
    familyId: string;
    husbandId: string;
    wifeId: string;
    type: MarriageType;
    order: number;
  }[] = [];
  // husband -> wives count（用于 order）
  const husbandWifeCount = new Map<string, number>();

  for (const r of rows) {
    if (!r.fatherExternalId || !r.motherExternalId) continue;
    const husbandId = idMap.get(r.fatherExternalId);
    const wifeId = idMap.get(r.motherExternalId);
    if (!husbandId || !wifeId) continue;
    const k = `${husbandId}::${wifeId}`;
    if (marriageKeys.has(k)) continue;
    marriageKeys.add(k);
    const order = (husbandWifeCount.get(husbandId) ?? 0) + 1;
    husbandWifeCount.set(husbandId, order);
    marriages.push({
      familyId: family.id,
      husbandId,
      wifeId,
      type: order === 1 ? MarriageType.PRIMARY : MarriageType.SECONDARY,
      order,
    });
  }
  for (let i = 0; i < marriages.length; i += BATCH) {
    const slice = marriages.slice(i, i + BATCH);
    await prisma.marriage.createMany({ data: slice });
  }
  console.log(`   ${marriages.length} 条婚姻`);

  // 注：嫁入标记已在合成母亲时直接打上 isMarriedIn=true，无需再处理

  // ---------- 完成 ----------
  const stats = await prisma.person.groupBy({
    by: ["gender"],
    where: { familyId: family.id },
    _count: true,
  });
  console.log(`✅ 导入完成 family=${family.id}`);
  console.log("   性别分布:", stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
