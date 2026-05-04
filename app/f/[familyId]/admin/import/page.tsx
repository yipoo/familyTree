/**
 * 数据导入页（Web 端 Excel 上传）
 *
 * 路由：/f/[familyId]/admin/import
 * 仅族长/管理员可见（admin layout 已校验）。
 *
 * 流程：
 *   1. 上传 .xlsx → 干跑预估（mode=dry）
 *   2. 用户确认 → 点击 "执行导入"（mode=apply）
 *   3. 显示统计与告警
 */
import { ImportXlsxForm } from "./ImportXlsxForm";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">从 Excel 导入</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {`上传与"丁氏家族族谱成员表格"模板兼容的 .xlsx 文件。先做"干跑预估"，确认无误后再执行导入。`}
      </p>
      <ul className="mt-3 space-y-1 text-xs text-zinc-500 list-disc pl-5">
        <li>必备列：世系、ID、姓、名、性别。其余列可缺。</li>
        <li>父亲 / 母亲通过 ID 列定位（位置 5 = 父亲ID，位置 7 = 母亲ID）。</li>
        <li>已存在 (familyId, externalId) 的人物会被更新；未引用到的旧数据不会被删除。</li>
        <li>{`母亲若未在表中独立行存在，会自动以"嫁入"身份补建。`}</li>
      </ul>

      <ImportXlsxForm familyId={familyId} />
    </div>
  );
}
