import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";

const FILE = path.resolve(process.cwd(), "docs/丁氏家族族谱成员表格-2026430.xlsx");

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];

  for (let r = 2; r <= 5; r++) {
    const row = ws.getRow(r);
    const id = row.getCell(2).value;
    const fid = row.getCell(6).value;
    const mid = row.getCell(8).value;
    console.log(`R${r}:`,
      `id=${JSON.stringify(id)} type=${typeof id}`,
      `fid=${JSON.stringify(fid)} type=${typeof fid}`,
      `mid=${JSON.stringify(mid)} type=${typeof mid}`,
    );
  }

  // Now check ID column for first 1000 rows: how many are number vs string
  const idTypes = new Map<string, number>();
  const fidTypes = new Map<string, number>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = row.getCell(2).value;
    const fid = row.getCell(6).value;
    idTypes.set(typeof id, (idTypes.get(typeof id) ?? 0) + 1);
    fidTypes.set(typeof fid, (fidTypes.get(typeof fid) ?? 0) + 1);
  }
  console.log("ID types:", Object.fromEntries(idTypes));
  console.log("FID types:", Object.fromEntries(fidTypes));
}

main();
