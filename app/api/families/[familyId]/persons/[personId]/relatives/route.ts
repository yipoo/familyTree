import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  Gender,
  LifeStatus,
  MarriageType,
  ParentRelation,
} from "@/lib/generated/prisma/enums";
import { authErrorResponse, requireWriteOnPerson } from "@/lib/auth/guard";

/**
 * 一键添加亲属：根据 kind 自动建立必要的 Person + 关系记录。
 *
 * kind:
 *   father    新增父亲（生成男性人物 + 与本人建立 ParentChild）
 *   mother    新增母亲（女性 + ParentChild + 嫁入标记 + 与父亲建 Marriage 若有）
 *   spouse    新增配偶（与本人建 Marriage；性别相反默认）
 *   son       新增儿子（与本人 + 配偶建 ParentChild）
 *   daughter  新增女儿
 *   brother   新增兄弟（与本人父母建 ParentChild）
 *   sister    新增姐妹
 */

type Kind =
  | "father"
  | "mother"
  | "spouse"
  | "son"
  | "daughter"
  | "brother"
  | "sister";

interface Body {
  kind: Kind;
  name: string;
  birthOrder?: number | null;
  alias?: string | null;
  status?: "ALIVE" | "DECEASED" | "LOST" | "UNKNOWN";
  isMarriedIn?: boolean;
  /**
   * 仅对 son / daughter 有用：指定母亲（配偶）id；省略则取本人首位婚姻对象
   */
  spousePersonId?: string;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  try {
    await requireWriteOnPerson(familyId, personId);
  } catch (e) {
    return authErrorResponse(e);
  }
  const body = (await req.json()) as Body;

  const self = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!self) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "本人不存在" } },
      { status: 404 },
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "name 必填" } },
      { status: 400 },
    );
  }
  const name = body.name.trim();

  // 决策：性别 / 世代 / 嫁入标记
  let gender: Gender;
  let generation: number;
  let isMarriedIn = body.isMarriedIn ?? false;
  switch (body.kind) {
    case "father":
      gender = Gender.MALE;
      generation = self.generation - 1;
      break;
    case "mother":
      gender = Gender.FEMALE;
      generation = self.generation - 1;
      isMarriedIn = true;
      break;
    case "spouse":
      gender = self.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE;
      generation = self.generation;
      // 妻子默认嫁入；夫则不
      if (gender === Gender.FEMALE) isMarriedIn = true;
      break;
    case "son":
      gender = Gender.MALE;
      generation = self.generation + 1;
      break;
    case "daughter":
      gender = Gender.FEMALE;
      generation = self.generation + 1;
      break;
    case "brother":
      gender = Gender.MALE;
      generation = self.generation;
      break;
    case "sister":
      gender = Gender.FEMALE;
      generation = self.generation;
      break;
    default:
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: `未知 kind: ${body.kind}` } },
        { status: 400 },
      );
  }
  if (generation < 1) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "world generation < 1" } },
      { status: 400 },
    );
  }

  const gn = await prisma.generationName.findUnique({
    where: { familyId_generation: { familyId, generation } },
  });

  // 找当前对象的父母（用于 brother/sister）
  const myParents = await prisma.parentChild.findMany({
    where: { familyId, childId: personId },
  });

  // 找当前对象的配偶（用于 son/daughter 默认母亲）
  const myMarriagesAsHusband = await prisma.marriage.findMany({
    where: { familyId, husbandId: personId },
    orderBy: { order: "asc" },
  });
  const myMarriagesAsWife = await prisma.marriage.findMany({
    where: { familyId, wifeId: personId },
    orderBy: { order: "asc" },
  });

  // 在事务内创建
  const result = await prisma.$transaction(async (tx) => {
    const newPerson = await tx.person.create({
      data: {
        familyId,
        name,
        gender,
        generation,
        generationChar: gn?.character ?? null,
        birthOrder: body.birthOrder ?? null,
        alias: body.alias ?? null,
        status: (body.status ?? "ALIVE") as LifeStatus,
        isMarriedIn,
      },
    });

    if (body.kind === "father" || body.kind === "mother") {
      // 新人 → 本人 的 ParentChild
      await tx.parentChild.create({
        data: {
          familyId,
          parentId: newPerson.id,
          childId: personId,
          relation: ParentRelation.BIOLOGICAL,
          birthOrder: self.birthOrder ?? null,
          isPrimary: true,
        },
      });
      // 若另一方父母已存在，则建立 Marriage
      if (body.kind === "mother") {
        // 找本人的父亲
        const fatherRel = myParents.find(async (r) => {
          const p = await tx.person.findUnique({ where: { id: r.parentId } });
          return p?.gender === Gender.MALE;
        });
        if (fatherRel) {
          await tx.marriage.create({
            data: {
              familyId,
              husbandId: fatherRel.parentId,
              wifeId: newPerson.id,
              type: MarriageType.PRIMARY,
              order: 1,
            },
          });
        }
      } else {
        const motherRel = myParents.find(async (r) => {
          const p = await tx.person.findUnique({ where: { id: r.parentId } });
          return p?.gender === Gender.FEMALE;
        });
        if (motherRel) {
          await tx.marriage.create({
            data: {
              familyId,
              husbandId: newPerson.id,
              wifeId: motherRel.parentId,
              type: MarriageType.PRIMARY,
              order: 1,
            },
          });
        }
      }
    } else if (body.kind === "spouse") {
      // husband=男方, wife=女方
      const husbandId = self.gender === Gender.MALE ? personId : newPerson.id;
      const wifeId = self.gender === Gender.MALE ? newPerson.id : personId;
      const existing = await tx.marriage.count({ where: { familyId, husbandId } });
      await tx.marriage.create({
        data: {
          familyId,
          husbandId,
          wifeId,
          type: existing === 0 ? MarriageType.PRIMARY : MarriageType.SECONDARY,
          order: existing + 1,
        },
      });
    } else if (body.kind === "son" || body.kind === "daughter") {
      // 父亲 / 母亲 取决于 self 的性别
      let fatherId: string | null = null;
      let motherId: string | null = null;
      if (self.gender === Gender.MALE) {
        fatherId = self.id;
        motherId = body.spousePersonId ?? myMarriagesAsHusband[0]?.wifeId ?? null;
      } else {
        motherId = self.id;
        fatherId = body.spousePersonId ?? myMarriagesAsWife[0]?.husbandId ?? null;
      }
      if (fatherId) {
        await tx.parentChild.create({
          data: {
            familyId,
            parentId: fatherId,
            childId: newPerson.id,
            relation: ParentRelation.BIOLOGICAL,
            birthOrder: body.birthOrder ?? null,
            isPrimary: true,
          },
        });
      }
      if (motherId) {
        await tx.parentChild.create({
          data: {
            familyId,
            parentId: motherId,
            childId: newPerson.id,
            relation: ParentRelation.BIOLOGICAL,
            birthOrder: body.birthOrder ?? null,
            isPrimary: true,
          },
        });
      }
    } else if (body.kind === "brother" || body.kind === "sister") {
      // 与本人共享父母
      for (const r of myParents) {
        await tx.parentChild.create({
          data: {
            familyId,
            parentId: r.parentId,
            childId: newPerson.id,
            relation: ParentRelation.BIOLOGICAL,
            birthOrder: body.birthOrder ?? null,
            isPrimary: true,
          },
        });
      }
    }

    return newPerson;
  });

  return NextResponse.json({ data: result }, { status: 201 });
}
