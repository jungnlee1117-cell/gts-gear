import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.LESSON_SCRIPT_OPENAI_API_KEY || "";

const ALLOWED_KEYS = [
  "title", "profile", "education", "experience", "certificates",
  "current_heading", "current_line", "current_bullets",
];

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
    .from("teachers").select("role").eq("id", user.id).maybeSingle();
  return teacher?.role === "admin" || teacher?.role === "superadmin";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await verifyAdmin(req.headers.authorization))) {
    res.status(403).json({ error: "관리자 권한이 필요합니다." });
    return;
  }
  if (!OPENAI_API_KEY) {
    res.status(503).json({ error: "번역 기능을 쓰려면 Vercel에 OPENAI_API_KEY 설정이 필요합니다." });
    return;
  }

  const { from, to, fields } = req.body || {};
  if (!["ko", "en"].includes(from) || !["ko", "en"].includes(to) || from === to) {
    res.status(400).json({ error: "언어 설정이 올바르지 않습니다." });
    return;
  }
  const input = {};
  for (const key of ALLOWED_KEYS) {
    const v = fields?.[key];
    if (typeof v === "string" && v.trim()) input[key] = v;
  }
  if (!Object.keys(input).length) {
    res.status(200).json({ fields: {} });
    return;
  }

  const langName = (l) => (l === "ko" ? "Korean" : "English");
  const system = `You translate resume content from ${langName(from)} to ${langName(to)}.
Rules:
- Return JSON only, with exactly the same keys as the input.
- Keep line breaks, blank lines, bullets and any leading "## " markers exactly as they are.
- Keep proper nouns, company/school/institution names, dates, numbers and URLs; transliterate or use the official name when one exists.
- Use a concise, professional resume tone. Do not add or omit information.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.RESUME_TRANSLATE_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });
    if (!r.ok) throw new Error((await r.text()) || `OpenAI error ${r.status}`);
    const json = await r.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
    const out = {};
    for (const key of Object.keys(input)) {
      if (typeof parsed[key] === "string") out[key] = parsed[key];
    }
    res.status(200).json({ fields: out });
  } catch (err) {
    res.status(500).json({ error: err?.message || "번역에 실패했습니다." });
  }
}
