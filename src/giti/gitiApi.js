import { GITI_MODEL, GITI_SYSTEM_PROMPT } from "./gitiSystemPrompt.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** 정적 시스템 프롬프트 캐시 TTL — 근무 중 반복 호출에 유리 */
const SYSTEM_CACHE_CONTROL = { type: "ephemeral", ttl: "1h" };

export function getGitiApiKey() {
  return String(import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim();
}

/**
 * 시스템 프롬프트를 캐시 가능한 블록 배열로 구성.
 * - 1번 블록: 고정 GITI_SYSTEM_PROMPT (cache_control) → 반복 호출 시 캐시 히트
 * - 2번 블록: 선생님별 실시간 앱 데이터 (변동) → 캐시하지 않음
 */
export function buildGitiSystemBlocks(appContextText = "") {
  const blocks = [
    {
      type: "text",
      text: GITI_SYSTEM_PROMPT,
      cache_control: SYSTEM_CACHE_CONTROL,
    },
  ];
  const appContext = String(appContextText || "").trim();
  if (appContext) {
    blocks.push({
      type: "text",
      text: appContext,
    });
  }
  return blocks;
}

/**
 * @param {{ role: "user"|"assistant", content: string }[]} history
 * @param {string} userText
 * @param {{ appContextText?: string }} [options]
 * @returns {Promise<{ text: string, usage: object, model: string }>}
 */
export async function askGiti(history, userText, options = {}) {
  const apiKey = getGitiApiKey();
  if (!apiKey) {
    throw new Error(
      "AI 키가 설정되지 않았어요. .env.local 에 VITE_ANTHROPIC_API_KEY 를 저장한 뒤 npm run dev 를 재시작하거나, Vercel 환경변수를 확인해주세요.",
    );
  }

  const messages = [
    ...(history || [])
      .filter((m) => m?.role === "user" || m?.role === "assistant")
      .filter((m) => String(m.content || "").trim())
      .map((m) => ({ role: m.role, content: String(m.content).trim() })),
    { role: "user", content: String(userText || "").trim() },
  ].filter((m) => m.content);

  if (!messages.length) throw new Error("메시지를 입력해주세요.");

  // 컨텍스트 과다 방지 — 최근 20턴
  const trimmed = messages.slice(-20);

  const appContext = String(options.appContextText || "").trim();
  const system = buildGitiSystemBlocks(appContext);

  console.log("[giti] askGiti system prompt", {
    hasAppContext: Boolean(appContext),
    appContextChars: appContext.length,
    systemBlocks: system.length,
    staticChars: GITI_SYSTEM_PROMPT.length,
    liveAttached: appContext.includes("GITI_LIVE_DATA_ATTACHED=true"),
    promptCaching: true,
    cacheControl: SYSTEM_CACHE_CONTROL,
    appContextPreview: appContext.slice(0, 500),
  });

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: GITI_MODEL,
      max_tokens: 2048,
      system,
      messages: trimmed,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `API 오류 (${res.status})`;
    throw new Error(msg);
  }

  const usage = data?.usage || {};
  console.log("[giti] prompt cache usage", {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_hit: (usage.cache_read_input_tokens || 0) > 0,
  });

  const text = (data?.content || [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("답변을 받지 못했어요. 다시 시도해주세요.");
  return {
    text,
    usage,
    model: data?.model || GITI_MODEL,
  };
}
