/**
 * AI 人物传记生成
 *
 *   POST { save?: boolean }
 *     - 汇集该人物的结构化事实（父母 / 配偶 / 子女 / 字辈 / 支系 / 居住地）
 *     - 调 LLM 生成中文小传
 *     - save=true 时写回 person.biography 并记审计
 *
 * 权限：对该人物有写权限（requireWriteOnPerson，含子树管理员）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireWriteOnPerson } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, badRequest, notFound } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { llmConfigured, LlmNotConfiguredError } from "@/lib/services/llm";
import { generateBiography, type BiographyFacts } from "@/lib/services/biography";

const Schema = z.object({ save: z.boolean().optional() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  try {
    const auth = await requireWriteOnPerson(familyId, personId);

    if (!llmConfigured()) {
      return badRequest("LLM_NOT_CONFIGURED", "AI 文本服务未配置，请联系管理员设置 DASHSCOPE_API_KEY");
    }

    const json = (await readJson<unknown>(req)) ?? {};
    const parsed = Schema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    const person = await prisma.person.findFirst({
      where: { id: personId, familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        gender: true,
        generation: true,
        generationChar: true,
        birthYear: true,
        deathYear: true,
        birthPlace: true,
        status: true,
        succession: true,
        note: true,
        paperRecord: true,
        biography: true,
        branch: { select: { name: true } },
        residence: { select: { fullText: true } },
      },
    });
    if (!person) return notFound("人物不存在");

    // 父母
    const parentRels = await prisma.parentChild.findMany({
      where: { childId: personId, familyId },
      select: { parent: { select: { name: true, gender: true } } },
    });
    const fatherName = parentRels.find((r) => r.parent.gender === "MALE")?.parent.name ?? null;
    const motherName = parentRels.find((r) => r.parent.gender === "FEMALE")?.parent.name ?? null;

    // 配偶
    const marriages = await prisma.marriage.findMany({
      where: { familyId, OR: [{ husbandId: personId }, { wifeId: personId }] },
      select: {
        type: true,
        order: true,
        husband: { select: { id: true, name: true } },
        wife: { select: { id: true, name: true } },
      },
      orderBy: { order: "asc" },
    });
    const spouses = marriages.map((m) => ({
      name: m.husband.id === personId ? m.wife.name : m.husband.name,
      type: m.type,
    }));

    // 子女
    const childRels = await prisma.parentChild.findMany({
      where: { parentId: personId, familyId },
      select: { child: { select: { name: true, gender: true, birthOrder: true } } },
      orderBy: { child: { birthOrder: "asc" } },
    });
    const children = childRels.map((r) => ({ name: r.child.name, gender: r.child.gender }));

    // 字辈字（优先字辈表）
    const genName = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation: person.generation } },
      select: { character: true },
    });

    const facts: BiographyFacts = {
      name: person.name,
      alias: person.alias,
      gender: person.gender,
      generation: person.generation,
      generationChar: genName?.character ?? person.generationChar,
      birthYear: person.birthYear,
      deathYear: person.deathYear,
      birthPlace: person.birthPlace,
      residence: person.residence?.fullText ?? null,
      status: person.status,
      branchName: person.branch?.name ?? null,
      succession: person.succession,
      fatherName,
      motherName,
      spouses,
      children,
      hints: person.note ?? person.paperRecord ?? null,
    };

    const text = await generateBiography(facts);
    if (!text) return badRequest("EMPTY", "生成失败，请重试");

    let saved = false;
    if (parsed.data.save) {
      await prisma.person.update({ where: { id: personId }, data: { biography: text } });
      saved = true;
      await writeAudit({
        familyId,
        actorId: auth.user.id,
        kind: "UPDATE",
        entity: "Person",
        entityId: personId,
        before: { biography: person.biography },
        after: { biography: text },
      });
    }

    return NextResponse.json({ data: { biography: text, saved } });
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) {
      return badRequest("LLM_NOT_CONFIGURED", e.message);
    }
    return handleApiError(e);
  }
}
