/**
 * AI 人物传记 / 小传生成。
 *
 * 把人物结构化事实（生卒、婚配、子女、迁徙、字辈等）拼成提示词，交给 LLM
 * 生成典雅简洁的中文小传。核心约束：**只依据给定事实，不得虚构**（反幻觉）。
 *
 * `buildBiographyMessages` 为纯函数（便于单测）；`generateBiography` 调 LLM。
 */
import { chat, type ChatMessage } from "@/lib/services/llm";

export interface BiographyFacts {
  name: string;
  alias?: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  residence?: string | null;
  status?: "ALIVE" | "DECEASED" | "LOST" | "UNKNOWN";
  branchName?: string | null;
  succession?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouses?: Array<{ name: string; type?: string | null }>;
  children?: Array<{ name: string; gender?: "MALE" | "FEMALE" | "UNKNOWN" }>;
  /** 已有备注 / 纸谱行传，作为可选素材 */
  hints?: string | null;
}

const MARRIAGE_TYPE_LABEL: Record<string, string> = {
  PRIMARY: "原配",
  SECONDARY: "继配",
  CONCUBINE: "侧室",
  UXORILOCAL: "入赘",
};

const GENDER_LABEL: Record<string, string> = {
  MALE: "男",
  FEMALE: "女",
  UNKNOWN: "不详",
};

/** 把事实整理成给模型的事实清单文本（中文、要点式）。 */
export function formatFactSheet(f: BiographyFacts): string {
  const lines: string[] = [];
  lines.push(`姓名：${f.name}${f.alias ? `（字/号：${f.alias}）` : ""}`);
  lines.push(`性别：${GENDER_LABEL[f.gender] ?? "不详"}`);
  lines.push(
    `世系：第 ${f.generation} 世${f.generationChar ? `（字辈「${f.generationChar}」）` : ""}`,
  );
  if (f.branchName) lines.push(`支系：${f.branchName}`);
  if (f.birthYear) lines.push(`生年：${f.birthYear}`);
  if (f.deathYear) lines.push(`卒年：${f.deathYear}`);
  if (f.birthYear && f.deathYear) lines.push(`享年：约 ${f.deathYear - f.birthYear} 岁`);
  if (f.status === "ALIVE") lines.push(`状态：在世`);
  if (f.birthPlace) lines.push(`出生地：${f.birthPlace}`);
  if (f.residence) lines.push(`居住地：${f.residence}`);
  if (f.fatherName) lines.push(`父：${f.fatherName}`);
  if (f.motherName) lines.push(`母：${f.motherName}`);
  if (f.spouses?.length) {
    lines.push(
      `配偶：${f.spouses
        .map((s) => `${s.name}${s.type && MARRIAGE_TYPE_LABEL[s.type] ? `（${MARRIAGE_TYPE_LABEL[s.type]}）` : ""}`)
        .join("、")}`,
    );
  }
  if (f.children?.length) {
    const sons = f.children.filter((c) => c.gender === "MALE").map((c) => c.name);
    const daughters = f.children.filter((c) => c.gender === "FEMALE").map((c) => c.name);
    const parts: string[] = [];
    if (sons.length) parts.push(`子 ${sons.length} 人：${sons.join("、")}`);
    if (daughters.length) parts.push(`女 ${daughters.length} 人：${daughters.join("、")}`);
    const other = f.children.filter((c) => c.gender !== "MALE" && c.gender !== "FEMALE");
    if (other.length) parts.push(`另 ${other.length} 人：${other.map((c) => c.name).join("、")}`);
    if (parts.length) lines.push(`子女：${parts.join("；")}`);
  }
  if (f.succession) lines.push(`出承/嗣：${f.succession}`);
  if (f.hints) lines.push(`其它线索：${f.hints}`);
  return lines.join("\n");
}

const SYSTEM_PROMPT = [
  "你是一位严谨的家谱传记撰写助手，熟悉中国传统谱牒文风。",
  "请依据下面提供的「事实清单」，为该人物撰写一段典雅、简洁、通顺的中文小传。",
  "硬性要求：",
  "1. 只能依据给定事实，严禁虚构生卒年、官职、功名、事迹、地名等任何未提供的具体信息；",
  "2. 事实不足时宁可简略，不要编造；不确定的内容不写；",
  "3. 用第三人称、书面语；可用「公」「氏」「讳」「字」等谱牒称谓，但不堆砌；",
  "4. 篇幅约 150–280 字，一段或两段，不要分点、不要标题、不要前后缀说明；",
  "5. 直接输出传记正文本身。",
].join("\n");

export function buildBiographyMessages(f: BiographyFacts): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `事实清单：\n${formatFactSheet(f)}\n\n请据此撰写人物小传。`,
    },
  ];
}

export async function generateBiography(f: BiographyFacts): Promise<string> {
  const messages = buildBiographyMessages(f);
  const r = await chat({ messages, temperature: 0.7, maxTokens: 900 });
  return r.content.trim();
}
