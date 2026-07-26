import { GITI_MODEL, GITI_SYSTEM_PROMPT } from "./gitiSystemPrompt.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function getGitiApiKey() {
  return String(import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim();
}

/**
 * @param {{ role: "user"|"assistant", content: string }[]} history
 * @param {string} userText
 * @returns {Promise<string>}
 */
export async function askGiti(history, userText) {
  const apiKey = getGitiApiKey();
  if (!apiKey) {
    throw new Error(
      "AI 키가 설정되지 않았어요. Vercel 환경변수 VITE_ANTHROPIC_API_KEY 를 확인해주세요.",
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
      system: GITI_SYSTEM_PROMPT,
      messages: trimmed,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `API 오류 (${res.status})`;
    throw new Error(msg);
  }

  const text = (data?.content || [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("답변을 받지 못했어요. 다시 시도해주세요.");
  return text;
}
