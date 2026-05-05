/**
 * GET /api/families/[familyId]/album/pdf
 *
 * 服务端生成册谱 PDF（@react-pdf/renderer）。
 */
import { NextResponse } from "next/server";

import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { buildAlbumBook } from "@/lib/services/album";
import { renderAlbumPdf } from "@/lib/pdf/album";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const book = await buildAlbumBook(familyId);
    if (!book) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }
    const buf = await renderAlbumPdf(book);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="album-${book.family.surname}-${book.family.name}.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
