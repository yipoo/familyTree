/**
 * 册谱前置章节：默认列表 + 解析（纯函数，可单测）。
 *
 * 设计要点（见 plan）：
 *   - 老家族没有任何 AlbumSection 记录时，渲染层运行时回退到 defaultAlbumSections()，
 *     渲染结果与改造前逐节一致（向后兼容）。
 *   - 默认章节 id=null（虚拟，未落库），title=null/body=null → 渲染器走"模板回退"，
 *     即沿用 components/album/CompletePages.tsx 里既有的硬编码模板文。
 *   - 一旦用户在后台点"初始化章节"（POST .../album-sections/reset）把默认列表落库，
 *     之后排序 / 编辑 / 删除才有真实 id 可操作。
 *
 * 章节分三类：
 *   - 数据驱动（SYSTEM_KINDS）：内容由族数据自动生成，body 被忽略，只能开关、不能删。
 *   - 文本/模板（TEXT_KINDS）：body 为空走模板文，填了用 markdown 覆盖。
 *   - 自定义（CUSTOM_*）：用户自由插入，可删。
 */
import { AlbumSectionKind } from "@/lib/generated/prisma/enums";

/** 渲染器/编辑器消费的统一章节形状（DB 行与虚拟默认项都收敛到这里）。 */
export interface ResolvedSection {
  /** null = 虚拟默认项（尚未落库）；非空 = 真实 DB 行 id。 */
  id: string | null;
  kind: AlbumSectionKind;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  signature: string | null;
  imageUrl: string | null;
  order: number;
  enabled: boolean;
  appliesTo: string[];
}

/** DB 行的结构化最小形状（prisma.albumSection 查询结果可直接传入）。 */
export interface AlbumSectionRow {
  id: string;
  kind: AlbumSectionKind;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  signature: string | null;
  imageUrl: string | null;
  order: number;
  enabled: boolean;
  appliesTo: string[];
}

/** 数据驱动章节：内容自动生成，body 忽略，不可删除（仅可开关）。 */
export const SYSTEM_KINDS: AlbumSectionKind[] = [
  AlbumSectionKind.ZIBEI,
  AlbumSectionKind.COMPILERS,
  AlbumSectionKind.TULU,
  AlbumSectionKind.PORTRAITS,
];

/** 文本/模板章节：body 为空走模板文，填了用 markdown 覆盖。 */
export const TEXT_KINDS: AlbumSectionKind[] = [
  AlbumSectionKind.FANLI,
  AlbumSectionKind.PREFACE,
  AlbumSectionKind.YUANLIU,
  AlbumSectionKind.RULES,
  AlbumSectionKind.POSTSCRIPT,
];

export function isSystemKind(k: AlbumSectionKind): boolean {
  return SYSTEM_KINDS.includes(k);
}

export function isCustomKind(k: AlbumSectionKind): boolean {
  return k === AlbumSectionKind.CUSTOM_TEXT || k === AlbumSectionKind.CUSTOM_IMAGE;
}

/** 只有自定义章节可删；系统/文本/封面章节只能开关（服务端 + 前端双重防御）。 */
export function canDeleteKind(k: AlbumSectionKind): boolean {
  return isCustomKind(k);
}

/** 可由用户新建插入的章节类型（自定义文字/图片 + 多篇谱序）。 */
export const INSERTABLE_KINDS: AlbumSectionKind[] = [
  AlbumSectionKind.CUSTOM_TEXT,
  AlbumSectionKind.CUSTOM_IMAGE,
  AlbumSectionKind.PREFACE,
];

export function isInsertableKind(k: AlbumSectionKind): boolean {
  return INSERTABLE_KINDS.includes(k);
}

/** 章节默认抬头：用于目录、章节标题、后台列表标签（section.title 为空时回退到此）。 */
export function defaultTitleForKind(k: AlbumSectionKind): string {
  switch (k) {
    case AlbumSectionKind.COVER:
      return "封面";
    case AlbumSectionKind.PREFACE:
      return "谱序";
    case AlbumSectionKind.FANLI:
      return "凡例";
    case AlbumSectionKind.YUANLIU:
      return "姓氏源流";
    case AlbumSectionKind.RULES:
      return "族规家训";
    case AlbumSectionKind.ZIBEI:
      return "字辈表";
    case AlbumSectionKind.COMPILERS:
      return "修谱人员";
    case AlbumSectionKind.TULU:
      return "世系图录";
    case AlbumSectionKind.PORTRAITS:
      return "像赞";
    case AlbumSectionKind.POSTSCRIPT:
      return "跋";
    case AlbumSectionKind.CUSTOM_TEXT:
      return "自定义章节";
    case AlbumSectionKind.CUSTOM_IMAGE:
      return "图片页";
    default:
      return "章节";
  }
}

/**
 * 默认章节列表（顺序严格对齐改造前 buildCompletePages：
 * 凡例 → 谱序 → 姓氏源流 → 字辈表 → 族规家训 → 修谱人员 → 世系图录 → 像赞 → 跋）。
 *
 * 封面 / 目录仍由 buildCompletePages 系统生成，不在章节列表中。
 * 缺数据的章节（如无族规、无字辈）渲染时产出 0 页 → 自动跳过、不进目录，
 * 与改造前的条件 push 行为等价。
 */
const DEFAULT_ORDER: AlbumSectionKind[] = [
  AlbumSectionKind.FANLI,
  AlbumSectionKind.PREFACE,
  AlbumSectionKind.YUANLIU,
  AlbumSectionKind.ZIBEI,
  AlbumSectionKind.RULES,
  AlbumSectionKind.COMPILERS,
  AlbumSectionKind.TULU,
  AlbumSectionKind.PORTRAITS,
  AlbumSectionKind.POSTSCRIPT,
];

export function defaultAlbumSections(): ResolvedSection[] {
  return DEFAULT_ORDER.map((kind, i) => ({
    id: null,
    kind,
    title: null,
    subtitle: null,
    body: null,
    signature: null,
    imageUrl: null,
    order: i,
    enabled: true,
    appliesTo: [],
  }));
}

/**
 * 默认章节落库用的 createMany 数据（纯函数，供 reset 端点与"首次写自动 seed"复用，
 * 让本文件不依赖 prisma、保持可单测）。
 */
export function defaultSectionCreateData(
  familyId: string,
): Array<{
  familyId: string;
  kind: AlbumSectionKind;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  signature: string | null;
  imageUrl: string | null;
  order: number;
  enabled: boolean;
  appliesTo: string[];
}> {
  return defaultAlbumSections().map((d) => ({
    familyId,
    kind: d.kind,
    title: d.title,
    subtitle: d.subtitle,
    body: d.body,
    signature: d.signature,
    imageUrl: d.imageUrl,
    order: d.order,
    enabled: d.enabled,
    appliesTo: d.appliesTo,
  }));
}

/**
 * 解析：DB 有记录用 DB（按 order 升序，order 相同按插入序稳定），空则回退默认列表。
 */
export function resolveAlbumSections(
  rows: AlbumSectionRow[] | null | undefined,
): ResolvedSection[] {
  if (!rows || rows.length === 0) return defaultAlbumSections();
  return rows
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      body: r.body,
      signature: r.signature,
      imageUrl: r.imageUrl,
      order: r.order,
      enabled: r.enabled,
      appliesTo: r.appliesTo ?? [],
    }))
    .sort((a, b) => a.order - b.order);
}
