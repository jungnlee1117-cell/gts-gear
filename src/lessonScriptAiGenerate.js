import { generateLessonScriptLocally } from "./lessonScriptAiGenerateLocal.js";

const GENERATE_URL = "/api/lesson-script/generate";

/**
 * @param {import("./lessonScriptAiTypes.js").AiGenerateInput} input
 * @param {string} [accessToken]
 */
export async function generateLessonScriptWithAi(input, accessToken) {
  if (accessToken) {
    try {
      const res = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          return { ...data.result, source: "ai" };
        }
      }

      if (res.status === 503) {
        return generateLessonScriptLocally(input);
      }
    } catch {
      // fallback below
    }
  }

  return generateLessonScriptLocally(input);
}

export { generateLessonScriptLocally };
