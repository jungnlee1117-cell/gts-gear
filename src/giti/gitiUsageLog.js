/**
 * 지티 질문 카테고리 분류 + 사용 로그 저장
 */

export const GITI_CATEGORIES = [
  "수업운영",
  "아이대처",
  "교구활동",
  "영어표현",
  "이벤트",
  "기타",
];

const RULES = [
  {
    category: "아이대처",
    keys: ["울", "떼", "산만", "싸움", "다툼", "ADHD", "발달", "거부", "안 들어", "다쳤", "다친", "아이"],
  },
  {
    category: "영어표현",
    keys: ["영어", "english", "표현", "스크립트", "script", "단어", "말해"],
  },
  {
    category: "교구활동",
    keys: ["교구", "에어", "활동", "게임", "밸런스", "공류", "터널", "매트", "이번 주 배정"],
  },
  {
    category: "이벤트",
    keys: ["이벤트", "할로윈", "어린이날", "크리스마스", "추석", "설날", "나비에로", "운동회", "졸업", "입학"],
  },
  {
    category: "수업운영",
    keys: ["수업", "스케줄", "시간표", "워밍업", "준비운동", "마무리", "만 ", "세 ", "연령", "급여", "공지", "앱"],
  },
];

export function normalizeGitiQuestion(raw) {
  return String(raw || "")
    .replace(/\[이번 주 배정 교구:[\s\S]*$/m, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function classifyGitiCategory(question) {
  const q = String(question || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keys.some((k) => q.includes(String(k).toLowerCase()))) {
      return rule.category;
    }
  }
  return "기타";
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function logGitiUsage(supabase, {
  teacherId,
  sessionId,
  question,
  answer,
  model,
  usage,
}) {
  if (!supabase || !teacherId || !question) {
    return { ok: false, error: "missing args" };
  }
  const questionNorm = normalizeGitiQuestion(question);
  if (!questionNorm) return { ok: false, error: "empty question" };

  const row = {
    teacher_id: teacherId,
    session_id: sessionId || null,
    question: String(question).trim().slice(0, 4000),
    question_norm: questionNorm,
    category: classifyGitiCategory(questionNorm),
    answer_preview: String(answer || "").trim().slice(0, 500) || null,
    model: model || null,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    cache_read_input_tokens: usage?.cache_read_input_tokens ?? null,
    cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? null,
  };

  const { error } = await supabase.from("giti_usage_events").insert(row);
  if (error) {
    console.warn("[giti] usage log failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
