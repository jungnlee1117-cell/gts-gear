import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.LESSON_SCRIPT_OPENAI_API_KEY || "";

const SYSTEM_PROMPT = `You are an expert PE (physical education) lesson script writer for Korean English immersion kindergartens/elementary programs.
Generate lesson content in JSON only. English scripts should be natural teacher talk for young learners.
- easy: very short phrases, 1-2 short sentences max
- medium: standard classroom English, 2-3 sentences
- hard: longer, includes open questions or student interaction prompts
Always provide at least 3 alternatives for scripts and safetyMemo.
Respond with valid JSON matching the schema exactly.`;

function buildUserPrompt(input) {
  const typeLabel = {
    "warmup-activity": "준비운동 (warm-up)",
    game: "게임 활동 (game)",
    "gear-lesson": "교구 수업 (gear lesson)",
  }[input.activityType] || "activity";

  return `Create a ${typeLabel} lesson script package.

Input:
- Activity name: ${input.activityName}
- Target age: ${input.targetAge}
- Goal: ${input.goal}
- Atmosphere: ${input.atmosphere}
- Gear/equipment: ${input.gear || "none"}
- Precautions: ${input.precautions}
${input.gearLabel ? `- Gear label: ${input.gearLabel}` : ""}
${input.levelLabel ? `- Lesson level: ${input.levelLabel}` : ""}

Return JSON:
{
  "activityName": "string",
  "meta": {
    "description": "Korean activity description",
    "setup": "Korean setup steps, newline separated",
    "progressSteps": "Korean numbered progress steps, newline separated",
    "recommendedAge": "string",
    "recommendedDuration": "string e.g. 5-8분",
    "appropriateSize": "string e.g. 8-12명",
    "energyLevel": "낮음|중간|높음",
    "ruleDifficulty": "쉬움|보통|어려움",
    "physicalGoalTags": ["tag1","tag2"],
    "atmosphereTags": ["tag1","tag2"],
    "recommendedSituations": ["situation1","situation2"],
    "avoidSituations": ["situation1","situation2"]
  },
  "scripts": {
    "default": { "easy": "", "medium": "", "hard": "" },
    "alternatives": [
      { "easy": "", "medium": "", "hard": "" },
      { "easy": "", "medium": "", "hard": "" },
      { "easy": "", "medium": "", "hard": "" }
    ]
  },
  "safetyMemo": {
    "default": { "easy": "", "medium": "", "hard": "" },
    "alternatives": [
      { "easy": "", "medium": "", "hard": "" },
      { "easy": "", "medium": "", "hard": "" },
      { "easy": "", "medium": "", "hard": "" }
    ]
  },
  "gearLessonText": "only for gear-lesson type: full multi-section English script with Teacher/Kids lines, else empty string"
}`;
}

async function verifyAdmin(authHeader) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return false;
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return teacher?.role === "admin" || teacher?.role === "superadmin";
}

async function callOpenAi(input) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LESSON_SCRIPT_OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return JSON.parse(content);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const allowed = await verifyAdmin(req.headers.authorization);
  if (!allowed) {
    res.status(403).json({ error: "관리자 권한이 필요합니다." });
    return;
  }

  const input = req.body;
  if (!input?.activityName?.trim()) {
    res.status(400).json({ error: "활동명을 입력해 주세요." });
    return;
  }

  if (!OPENAI_API_KEY) {
    res.status(503).json({ error: "OPENAI_API_KEY not configured", useLocal: true });
    return;
  }

  try {
    const result = await callOpenAi(input);
    res.status(200).json({ result: { ...result, source: "ai" } });
  } catch (err) {
    res.status(500).json({ error: err?.message || "AI generation failed" });
  }
}
