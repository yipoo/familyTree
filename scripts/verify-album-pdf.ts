import "dotenv/config";
import { prisma } from "@/lib/db";
import { buildAlbumBook } from "@/lib/services/album";
import { renderAlbumPdfStrict } from "@/lib/pdf/album";

/**
 * 手动验证册谱 PDF 完整渲染（尤其超大族谱）。用 renderAlbumPdfStrict（不走兜底），
 * 布局崩溃会直接抛出，从而能判断是否真渲染成功。
 *
 * react-pdf 不支持 .ttc，本机须用 .ttf/.otf：
 *   CJK_FONT_PATH="$HOME/Library/Fonts/NotoSansCJKsc-Regular.otf" \
 *     npx tsx scripts/verify-album-pdf.ts
 *
 * 可选环境变量：
 *   FAMILY_ID=<id>   指定家族（默认取人物最多的家族）
 *   OUT=<path>       把 PDF 写到文件，便于 pdftotext / pdftoppm 抽查
 */
async function pickFamily(): Promise<string | null> {
  if (process.env.FAMILY_ID) return process.env.FAMILY_ID;
  const rows = await prisma.person.groupBy({
    by: ["familyId"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  rows.sort((a, b) => b._count._all - a._count._all);
  return rows[0]?.familyId ?? null;
}

async function main() {
  const familyId = await pickFamily();
  if (!familyId) return console.log("没有家族数据");

  const t0 = Date.now();
  const book = await buildAlbumBook(familyId);
  if (!book) return console.log("buildAlbumBook 返回 null");

  const entries = book.volumes.reduce(
    (s, v) => s + v.chapters.reduce((c, ch) => c + ch.entries.length, 0),
    0,
  );
  console.log(
    `家族="${book.family.name}" 卷数=${book.volumes.length} 条目=${entries} 装配=${Date.now() - t0}ms`,
  );

  const t1 = Date.now();
  const buf = await renderAlbumPdfStrict(book);
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`✅ 渲染成功 bytes=${buf.length} pages≈${pages} 耗时=${Date.now() - t1}ms`);

  if (process.env.OUT) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.OUT, buf);
    console.log(`   已写出 ${process.env.OUT}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ 失败：", e);
    await prisma.$disconnect();
    process.exit(1);
  });
