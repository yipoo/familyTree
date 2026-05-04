import ExcelJS from "exceljs";
async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/丁氏家族族谱成员表格-2026430.xlsx");
  const ws = wb.worksheets[0];
  for (let c = 1; c <= 10; c++) {
    const v = ws.getRow(1).getCell(c).value;
    console.log(`Col${c} header: ${JSON.stringify(v)}`);
  }
  console.log("--- Row 3 raw ---");
  for (let c = 1; c <= 10; c++) {
    const v = ws.getRow(3).getCell(c).value;
    console.log(`Col${c}: ${JSON.stringify(v)}`);
  }
}
main();
