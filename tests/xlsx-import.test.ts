import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { parseXlsxBuffer } from "@/lib/services/xlsx-import";

async function makeXlsxBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow([
    "世系",
    "ID",
    "姓",
    "名",
    "父亲ID",
    "父亲",
    "母亲ID",
    "母亲",
    "别名",
    "性别",
    "排行",
    "生日",
    "出生地",
    "字辈",
    "出承",
    "是否健在",
    "纸谱行传",
    "线索备注",
    "个人传记",
  ]);
  // 父
  ws.addRow([
    "第1世",
    "1",
    "丁",
    "老",
    "",
    "",
    "",
    "",
    "",
    "男",
    "1",
    "1900",
    "丁庄",
    "天",
    "",
    "否",
    "",
    "",
    "",
  ]);
  // 子（父=1，母=99 不在表中）
  ws.addRow([
    "第二世",
    "2",
    "丁",
    "二",
    "1",
    "丁老",
    "99",
    "李氏",
    "二郎",
    "男",
    "1",
    "1925",
    "",
    "地",
    "",
    "是",
    "",
    "",
    "",
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("parseXlsxBuffer", () => {
  it("能读出全部行 + 解析中文世代 + 性别枚举", async () => {
    const buf = await makeXlsxBuffer();
    const r = await parseXlsxBuffer(buf);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].generation).toBe(1);
    expect(r.rows[1].generation).toBe(2);
    expect(r.rows[0].gender).toBe("MALE");
    expect(r.rows[0].status).toBe("DECEASED");
    expect(r.rows[1].status).toBe("ALIVE");
  });

  it("字辈被聚合成 generationCharCounts", async () => {
    const buf = await makeXlsxBuffer();
    const r = await parseXlsxBuffer(buf);
    const gen1 = r.generationCharCounts.get(1);
    const gen2 = r.generationCharCounts.get(2);
    expect(gen1?.get("天")).toBe(1);
    expect(gen2?.get("地")).toBe(1);
  });

  it("父母 ID 通过位置硬编码（5/7 列）抓取", async () => {
    const buf = await makeXlsxBuffer();
    const r = await parseXlsxBuffer(buf);
    expect(r.rows[1].fatherExternalId).toBe("1");
    expect(r.rows[1].motherExternalId).toBe("99");
    expect(r.rows[1].motherName).toBe("李氏");
  });
});
