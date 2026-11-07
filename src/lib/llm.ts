import { invoke } from "@tauri-apps/api/core";

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  useMock: boolean;
}

export interface GeneratedNote {
  title: string;
  content: string;
  tags: string[];
}

export class LLMError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LLMError";
  }
}

export async function generateNote(
  groupTitle: string,
  photoCaptions: string[],
  cfg: LLMConfig,
): Promise<GeneratedNote> {
  if (cfg.useMock) {
    return {
      title: `${groupTitle}｜把今天过得松弛一点`,
      content:
        "没有刻意安排的一天，反而装下了最喜欢的片段。\n\n光落在桌角，风从窗边经过，随手拍下的画面都带着一点慢下来的感觉。比起追赶行程，更想记住这些不紧不慢的小瞬间。\n\n生活不需要每分钟都有意义，留一点空白，也是在认真感受。",
      tags: ["#松弛感", "#生活记录", "#周末碎片"],
    };
  }

  const prompt = buildPrompt(groupTitle, photoCaptions);

  const requestPayload: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    // 可调参数：兼容接口支持 JSON Mode 时再取消注释。
    // response_format: { type: "json_object" },
    // 可调参数：温度越低越稳定，越高越发散。
    temperature: 0.7,
  };

  const url = validateEndpoint(cfg.endpoint.trim());
  const requestBody = JSON.stringify(requestPayload);

  console.log("[LLM outgoing]", { url, requestBody });

  let rawBody: string;
  try {
    rawBody = await invoke<string>("call_ccswitch_llm", {
      payload: requestBody,
    });
  } catch (error) {
    console.error("[LLM RAW ERROR]", error);
    throw new LLMError(
      `LLM network request failed. Raw error: ${JSON.stringify(error)}`,
      { cause: error },
    );
  }

  console.log("[LLM] response", {
    body: rawBody,
  });

  let responsePayload: unknown;
  try {
    responsePayload = JSON.parse(rawBody);
  } catch (error) {
    throw new LLMError("LLM response body is not valid JSON.", {
      cause: error,
    });
  }

  const content = isRecord(responsePayload)
    ? (
        responsePayload.choices as
          | Array<{
              message?: {
                content?: unknown;
              };
            }>
          | undefined
      )?.[0]?.message?.content
    : undefined;

  if (typeof content !== "string" || !content.trim()) {
    throw new LLMError(
      "LLM response does not contain choices[0].message.content.",
    );
  }

  return parseGeneratedNote(content);
}

function buildPrompt(
  groupName: string,
  imageDescriptions: string[],
): string {
  const descriptions = imageDescriptions
    .map((description) => description.trim())
    .filter(Boolean)
    .map((description) => `- ${description}`)
    .join("\n");

  return [
    "请根据以下信息写一篇中文小红书笔记。",
    `分组名称：${groupName}`,
    `图片描述：\n${descriptions || "- 暂无图片描述"}`,
    "",
    "写作要求：",
    "1. 风格松弛、自然、生活化，不要使用夸张营销话术。",
    "2. 正文分段清晰，适合手机阅读。",
    "3. 标题简洁有画面感，不要堆砌关键词。",
    "4. tags 提供 5 到 8 个，每个以 # 开头。",
    "5. 只能输出 JSON，不要使用 Markdown 代码块，不要补充解释。",
    "",
    'JSON 结构：{"title":"标题","content":"正文","tags":["#标签"]}',
  ].join("\n");
}

function validateEndpoint(value: string): string {
  const endpoint = value.trim();
  if (!endpoint) {
    throw new LLMError("LLM endpoint cannot be empty.");
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new LLMError("LLM endpoint must be a valid absolute URL.", {
      cause: error,
    });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new LLMError("LLM endpoint must use HTTP or HTTPS.");
  }
  return url.toString();
}

function parseGeneratedNote(content: string): GeneratedNote {
  const jsonText = extractJsonObject(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new LLMError("LLM returned invalid JSON.", { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new LLMError("LLM returned an invalid note object.");
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const noteContent =
    typeof parsed.content === "string" ? parsed.content.trim() : "";
  const tags = normalizeTags(parsed.tags);

  if (!title || !noteContent || tags.length === 0) {
    throw new LLMError(
      "LLM note must include non-empty title, content, and tags.",
    );
  }

  return {
    title,
    content,
    tags,
  };
}

function extractJsonObject(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new LLMError("LLM response did not contain a JSON object.");
  }
  return candidate.slice(start, end + 1);
}

function normalizeTags(value: unknown): string[] {
  const rawTags =
    typeof value === "string"
      ? value.split(/[,，\s]+/)
      : Array.isArray(value)
      ? value
      : [];

  return rawTags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
