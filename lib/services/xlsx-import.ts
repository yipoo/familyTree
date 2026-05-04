/**
 * Excel 解析（来自 scripts/import-xlsx.ts 的逻辑提炼）。
 *
 * 输入：Buffer（来自上传文件）
 * 输出：
 *   - rows：每行解析结果（含 externalId / 姓名 / 父母 ID 等）
 *   - generationCounts：每代字辈出现次数（用于推导字辈表）
 *   - issues：解析告警（不影响整体运行）
 *
 * 仅做"读 + 校验"；具体写库由 import-runner.ts 处理。
 */
import ExcelJS from "exceljs";

import type { Gender, LifeStatus } from "@/lib/generated/prisma/enums";

export interface XlsxRawPerson {
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

export interface XlsxParseResult {
  rows: XlsxRawPerson[];
  generationCharCounts: Map<number, Map<string, number>>;
  issues: string[];
}

function parseGeneration(s: string): number | null {
  if (!s) return null;
  const m = s.match(/第\s*([0-9一二三四五六七八九十百零]+)\s*世/);
  if (!m) return null;
  const raw = m[1];
  const n = Number(raw);
  if (!Number.isNaN(n)) return n;
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
  if (s === "男") return "MALE";
  if (s === "女") return "FEMALE";
  return "UNKNOWN";
}

function parseAlive(s: string): LifeStatus {
  if (s === "否") return "DECEASED";
  if (s === "是") return "ALIVE";
  return "UNKNOWN";
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

export async function parseXlsxBuffer(buf: Buffer): Promise<XlsxParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], generationCharCounts: new Map(), issues: ["Excel 无工作表"] };
  }

  const issues: string[] = [];
  const headers: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    headers.push(cellText(ws.getRow(1).getCell(c).value));
  }
  const idx = (name: string) => headers.indexOf(name) + 1;

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

  if (cols.gen <= 0) issues.push('缺少 "世系" 列；请检查模板');
  if (cols.id <= 0) issues.push('缺少 "ID" 列；请检查模板');

  const rows: XlsxRawPerson[] = [];
  const charCounts = new Map<number, Map<string, number>>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (c: number) => (c > 0 ? cellText(row.getCell(c).value) : "");
    const externalId = get(cols.id);
    if (!externalId) continue;
    const gen = parseGeneration(get(cols.gen));
    if (!gen) {
      issues.push(`第 ${r} 行：无法解析"世系"=${get(cols.gen)}`);
      continue;
    }

    const orderRaw = get(cols.order);
    const orderNum = orderRaw ? Number(orderRaw) : null;
    const birthOrder =
      orderNum != null && !Number.isNaN(orderNum) && orderNum > 0 ? orderNum : null;

    const generationChar = get(cols.char);
    if (generationChar) {
      const m = charCounts.get(gen) ?? new Map<string, number>();
      m.set(generationChar, (m.get(generationChar) ?? 0) + 1);
      charCounts.set(gen, m);
    }

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
      generationChar,
      succession: get(cols.succession),
      status: parseAlive(get(cols.alive)),
      paperRecord: get(cols.paper),
      noteHint: get(cols.note),
      biography: get(cols.bio),
      fatherExternalId: get(cols.fatherId),
      motherExternalId: get(cols.motherId),
      motherName: cols.motherId > 0 ? get(cols.motherId + 1) : "",
    });
  }
  return { rows, generationCharCounts: charCounts, issues };
}
