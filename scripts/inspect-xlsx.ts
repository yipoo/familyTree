import "dotenv/config";
import ExcelJS from "exceljs";
import path from "node:path";

const FILE = path.resolve(
  process.cwd(),
  "docs/丁氏家族族谱成员表格-2026430.xlsx",
);

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];

  // Headers
  const headers: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    headers.push(String(ws.getRow(1).getCell(c).value ?? ""));
  }

  // Stats
  const genderCount = new Map<string, number>();
  const aliveCount = new Map<string, number>();
  const generationCount = new Map<string, number>();
  let withFatherId = 0;
  let withMotherId = 0;
  let withSpouse = 0;
  let withBirthDate = 0;
  let withCurrentPlace = 0;
  let withPhone = 0;
  let withBio = 0;
  let withMark = 0;
  let withSuccession = 0;

  const samples: Record<string, string[]> = {
    spouse: [],
    mark: [],
    succession: [],
    note: [],
    biography: [],
    currentPlace: [],
    birthPlace: [],
    paperRecord: [],
  };

  // Field name → column index (1-based)
  const idx = (name: string) => headers.indexOf(name) + 1;
  const colSex = idx("性别");
  const colAlive = idx("是否健在");
  const colGen = idx("世系");
  const colFatherId = idx("父亲ID");
  const colMotherId = idx("母亲ID");
  const colSpouse = idx("婚配");
  const colBirth = idx("生日");
  const colCurrent = idx("现居地");
  const colPhone = idx("电话");
  const colBio = idx("个人传记");
  const colMark = idx("标记");
  const colSucc = idx("出承");
  const colNote = idx("线索备注");
  const colBirthP = idx("出生地");
  const colPaper = idx("纸谱行传");

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (c: number) => {
      const v = row.getCell(c).value;
      return v == null ? "" : String(typeof v === "object" ? JSON.stringify(v) : v).trim();
    };
    const sex = get(colSex);
    if (sex) genderCount.set(sex, (genderCount.get(sex) ?? 0) + 1);
    const alive = get(colAlive);
    if (alive) aliveCount.set(alive, (aliveCount.get(alive) ?? 0) + 1);
    const gen = get(colGen);
    if (gen) generationCount.set(gen, (generationCount.get(gen) ?? 0) + 1);

    if (get(colFatherId)) withFatherId++;
    if (get(colMotherId)) withMotherId++;
    const sp = get(colSpouse);
    if (sp) {
      withSpouse++;
      if (samples.spouse.length < 5) samples.spouse.push(sp);
    }
    if (get(colBirth)) withBirthDate++;
    const cp = get(colCurrent);
    if (cp) {
      withCurrentPlace++;
      if (samples.currentPlace.length < 5) samples.currentPlace.push(cp);
    }
    if (get(colPhone)) withPhone++;
    const bio = get(colBio);
    if (bio) {
      withBio++;
      if (samples.biography.length < 3) samples.biography.push(bio.slice(0, 80));
    }
    const mk = get(colMark);
    if (mk) {
      withMark++;
      if (samples.mark.length < 5 && !samples.mark.includes(mk))
        samples.mark.push(mk);
    }
    const sc = get(colSucc);
    if (sc) {
      withSuccession++;
      if (samples.succession.length < 5 && !samples.succession.includes(sc))
        samples.succession.push(sc);
    }
    const nt = get(colNote);
    if (nt && samples.note.length < 5) samples.note.push(nt.slice(0, 60));
    const bp = get(colBirthP);
    if (bp && samples.birthPlace.length < 5 && !samples.birthPlace.includes(bp))
      samples.birthPlace.push(bp);
    const pr = get(colPaper);
    if (pr && samples.paperRecord.length < 3)
      samples.paperRecord.push(pr.slice(0, 80));
  }

  console.log("Total rows (excl header):", ws.rowCount - 1);
  console.log("\nHeaders:");
  console.log(headers.map((h, i) => `${i + 1}.${h}`).join(" | "));

  console.log("\n性别:", Object.fromEntries(genderCount));
  console.log("是否健在:", Object.fromEntries(aliveCount));
  console.log("\n各世人数（前 10）：");
  const gens = [...generationCount.entries()].sort();
  console.log(gens.slice(0, 10), "... total gens =", gens.length);
  console.log("最大世:", gens[gens.length - 1]);

  console.log("\n字段填充情况:");
  console.log("  父亲ID:", withFatherId);
  console.log("  母亲ID:", withMotherId);
  console.log("  婚配:", withSpouse);
  console.log("  生日:", withBirthDate);
  console.log("  现居地:", withCurrentPlace);
  console.log("  电话:", withPhone);
  console.log("  个人传记:", withBio);
  console.log("  标记:", withMark);
  console.log("  出承:", withSuccession);

  console.log("\n样例:");
  for (const [k, v] of Object.entries(samples)) {
    console.log(`  ${k}:`, v);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
