/**
 * /f/[familyId]/admin/print-info —— 印刷家谱专用字段编辑
 *
 * 三个字段：
 *   - editionInfo  修谱版次（"初修"、"三续"等，封面用）
 *   - surnameOrigin 姓氏源流叙述（覆盖自动模板）
 *   - familyRules  族规家训正文（多段纯文本，按段分页排印）
 */

import { prisma } from "@/lib/db";
import { AdminSection } from "../_shared";
import { PrintInfoForm } from "./PrintInfoForm";

export const dynamic = "force-dynamic";

export default async function AdminPrintInfoPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true,
      name: true,
      familyRules: true,
      editionInfo: true,
      surnameOrigin: true,
    },
  });
  if (!family) return null;

  return (
    <AdminSection
      title="印刷家谱信息"
      description="为生成印刷家谱（合编本 / 牒记式 / 欧式 / 苏式 / 宝塔式）填写传统家谱所需的特殊章节内容。留空时合编本会用自动生成的模板文。"
    >
      <PrintInfoForm
        familyId={familyId}
        initial={{
          editionInfo: family.editionInfo,
          surnameOrigin: family.surnameOrigin,
          familyRules: family.familyRules,
        }}
      />
    </AdminSection>
  );
}
