/**
 * GET /api/families/[familyId]/export?format=json|csv|gedcom
 *
 * 默认 json。csv 时返回 text/csv 一份打包字符串（多张 csv 由 ; 段分隔头注释）。
 *   - format=csv          多片段拼接（适合粘贴；有"# === persons ===" 等分隔头）
 *   - format=csv-persons  仅 persons 一张表
 *   - format=csv-marriages
 *   - format=csv-parent-child
 *   - format=csv-generations
 *   - format=gedcom       GEDCOM 5.5.1
 *
 * 仅家族成员可导出（防止外泄）。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { attachmentDisposition } from "@/lib/api/download";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import {
  type ExportSnapshot,
  toCsvBundle,
  toGedcom,
  toJson,
} from "@/lib/services/exporters";

const ALLOWED_FORMATS = new Set([
  "json",
  "csv",
  "csv-persons",
  "csv-marriages",
  "csv-parent-child",
  "csv-generations",
  "gedcom",
]);

async function exportHandler(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");

    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "json";
    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: `不支持的格式：${format}` } },
        { status: 400 },
      );
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
      include: { generationNames: { orderBy: { generation: "asc" } } },
    });
    if (!family) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }

    const [persons, marriages, parentChild] = await Promise.all([
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
      }),
      prisma.marriage.findMany({
        where: { familyId },
        orderBy: [{ husbandId: "asc" }, { order: "asc" }],
      }),
      prisma.parentChild.findMany({
        where: { familyId },
      }),
    ]);

    const snap: ExportSnapshot = {
      family: {
        id: family.id,
        surname: family.surname,
        name: family.name,
        description: family.description,
        founderName: family.founderName,
      },
      generationNames: family.generationNames.map((g) => ({
        generation: g.generation,
        character: g.character,
      })),
      persons: persons.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        alias: p.alias,
        gender: p.gender,
        generation: p.generation,
        generationChar: p.generationChar,
        birthOrder: p.birthOrder,
        birthYear: p.birthYear,
        deathYear: p.deathYear,
        birthDate: p.birthDate,
        deathDate: p.deathDate,
        birthPlace: p.birthPlace,
        status: p.status,
        isMarriedIn: p.isMarriedIn,
        succession: p.succession,
        paperRecord: p.paperRecord,
        biography: p.biography,
        noteHint: p.noteHint,
      })),
      marriages: marriages.map((m) => ({
        id: m.id,
        husbandId: m.husbandId,
        wifeId: m.wifeId,
        type: m.type,
        order: m.order,
        marriedYear: m.marriedYear,
        endedYear: m.endedYear,
      })),
      parentChild: parentChild.map((pc) => ({
        id: pc.id,
        parentId: pc.parentId,
        childId: pc.childId,
        relation: pc.relation,
        birthOrder: pc.birthOrder,
        isPrimary: pc.isPrimary,
      })),
      generatedAt: new Date().toISOString(),
    };

    const fileBase = `${family.surname}-${family.name}`;

    if (format === "json") {
      return new NextResponse(toJson(snap), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": attachmentDisposition(`${fileBase}.json`),
        },
      });
    }

    if (format === "gedcom") {
      return new NextResponse(toGedcom(snap), {
        status: 200,
        headers: {
          "content-type": "application/x-gedcom; charset=utf-8",
          "content-disposition": attachmentDisposition(`${fileBase}.ged`),
        },
      });
    }

    const bundle = toCsvBundle(snap);
    if (format === "csv-persons") return csvResponse(bundle.persons, `${fileBase}-persons.csv`);
    if (format === "csv-marriages") return csvResponse(bundle.marriages, `${fileBase}-marriages.csv`);
    if (format === "csv-parent-child") return csvResponse(bundle.parentChild, `${fileBase}-parent-child.csv`);
    if (format === "csv-generations") return csvResponse(bundle.generationNames, `${fileBase}-generations.csv`);

    // format = "csv"：拼接四段
    const merged = [
      "# === generations ===",
      bundle.generationNames,
      "",
      "# === persons ===",
      bundle.persons,
      "",
      "# === marriages ===",
      bundle.marriages,
      "",
      "# === parentChild ===",
      bundle.parentChild,
    ].join("\n");
    return csvResponse(merged, `${fileBase}.csv`);
  } catch (e) {
    return handleApiError(e);
  }
}

// 限流：导出涉及全量扫表，每用户每分钟 10 次足够；IP 桶兜底防匿名滥用。
export const GET = withRateLimit(exportHandler, {
  bucket: "export",
  limit: 10,
  windowMs: 60_000,
  withUser: true,
});

function csvResponse(body: string, filename: string): NextResponse {
  // 加 BOM 让 Excel 正确识别 UTF-8
  return new NextResponse("﻿" + body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": attachmentDisposition(filename),
    },
  });
}
