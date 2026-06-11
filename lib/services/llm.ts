/**
 * LLM 文本生成网关（阿里云百炼 DashScope / Qwen，OpenAI 兼容协议）。
 *
 * Env（仅服务端）：
 *   DASHSCOPE_API_KEY     必填；未配置则 llmConfigured()=false、chat() 抛错
 *   QWEN_MODEL            默认 qwen-plus（qwen-turbo / qwen-plus / qwen-max）
 *   DASHSCOPE_CHAT_URL    可选，覆盖 chat completions 端点
 *
 * 用 raw fetch，不引 SDK——百炼 OpenAI 兼容端点结构与 OpenAI 一致。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
}

export class LlmNotConfiguredError extends Error {
  code = "LLM_NOT_CONFIGURED";
  constructor() {
    super("AI 文本服务未配置（缺少 DASHSCOPE_API_KEY）");
  }
}

const DEFAULT_CHAT_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

/** AI 文本能力是否可用（UI 用来决定按钮是否禁用）。 */
export function llmConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResult> {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new LlmNotConfiguredError();

  const model = opts.model ?? process.env.QWEN_MODEL ?? "qwen-plus";
  const url = process.env.DASHSCOPE_CHAT_URL ?? DEFAULT_CHAT_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM 调用失败 ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const u = data.usage ?? {};
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: {
      inputTokens: u.prompt_tokens ?? 0,
      outputTokens: u.completion_tokens ?? 0,
      totalTokens: u.total_tokens ?? 0,
    },
    model,
  };
}
