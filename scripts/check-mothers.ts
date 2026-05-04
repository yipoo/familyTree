import ExcelJS from "exceljs";
async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/丁氏家族族谱成员表格-2026430.xlsx");
  const ws = wb.worksheets[0];

  const allIds = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(2).value;
    if (v != null) allIds.add(String(v));
  }
  console.log("Total IDs in column 2 (Person.id):", allIds.size);

  const motherIds = new Set<string>();
  const motherIdsInSet = new Set<string>();
  const motherNames = new Map<string, number>();
  let totalMotherRefs = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const mid = ws.getRow(r).getCell(7).value; // 母亲ID
    const mname = ws.getRow(r).getCell(8).value; // 母亲 (name)
    if (mid != null && mid !== "") {
      const s = String(mid);
      motherIds.add(s);
      totalMotherRefs++;
      if (allIds.has(s)) motherIdsInSet.add(s);
    }
    if (mname != null && mname !== "") {
      const ns = String(mname);
      motherNames.set(ns, (motherNames.get(ns) ?? 0) + 1);
    }
  }
  console.log("Unique mother IDs referenced:", motherIds.size);
  console.log("  ... of which are in Person.id set:", motherIdsInSet.size);
  console.log("Total mother references (rows with non-empty mother ID):", totalMotherRefs);
  console.log("Unique mother NAMES:", motherNames.size);
  console.log("Top 10 mother names by count:");
  const top = [...motherNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [n, c] of top) console.log(`  ${n}: ${c}`);

  // Sample 5 rows
  console.log("\nFirst 8 rows with mother data:");
  let n = 0;
  for (let r = 2; r <= ws.rowCount && n < 8; r++) {
    const mid = ws.getRow(r).getCell(7).value;
    const mname = ws.getRow(r).getCell(8).value;
    if (mid || mname) {
      const id = ws.getRow(r).getCell(2).value;
      const name = ws.getRow(r).getCell(4).value;
      console.log(`  R${r}: id=${id} name=${name} motherId=${mid} motherName=${JSON.stringify(mname)}`);
      n++;
    }
  }
}
main();
