import { createClient } from "@supabase/supabase-js";
import { setDbGearScriptEntries } from "./gearScriptMeta.js";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      import.meta.env?.VITE_SUPABASE_URL || "",
      import.meta.env?.VITE_SUPABASE_ANON_KEY || "",
    );
  }
  return _supabase;
}

let loadPromise = null;

export function createGearScriptEntryId(label = "gear") {
  const slug = String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "gear";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `db-${slug}-${suffix}`;
}

export async function fetchGearScriptEntries() {
  const { data, error } = await getSupabase()
    .from("gear_script_entries")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** 앱 전역 merge 캐시 로드 (싱글톤) */
export function initGearScriptEntries({ force = false } = {}) {
  if (force) loadPromise = null;
  if (!loadPromise) {
    loadPromise = fetchGearScriptEntries()
      .then(rows => {
        setDbGearScriptEntries(rows);
        return rows;
      })
      .catch(err => {
        loadPromise = null;
        setDbGearScriptEntries([]);
        throw err;
      });
  }
  return loadPromise;
}

export async function findGearScriptEntryByItemId(itemId) {
  if (!itemId) return null;
  const { data, error } = await getSupabase()
    .from("gear_script_entries")
    .select("*")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertGearScriptEntry(row, userId) {
  const payload = {
    ...row,
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.created_by && userId) payload.created_by = userId;

  const { data, error } = await getSupabase()
    .from("gear_script_entries")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  await initGearScriptEntries({ force: true });
  return data;
}

/** 활동 대화 슬롯 정의 (폼 ↔ script[] 컴파일 순서) */
export const ACTIVITY_DIALOGUE_SLOTS = [
  { key: "intro_question", who: "teacher", label: "1. Teacher 도입·질문", hint: "질문형 도입 + 시연 동작" },
  { key: "kids_guess", who: "kids", label: "2. Kids 추측·반응", hint: "아이들 추측/반응" },
  { key: "teacher_guidance", who: "teacher", label: "3. Teacher 안내·안전", hint: "방법·안전 안내 (대화 안에 자연스럽게)" },
  { key: "student_callout", who: "teacher", label: "4. Teacher 개인 지목", hint: "예: 누가 제일 조심스럽게… 하은이!" },
  { key: "call_response_cue", who: "teacher", label: "5. Teacher 콜앤리스폰스", hint: "예: Let's go? (Let's go!)" },
  { key: "kids_reaction", who: "kids", label: "6. Kids 활동 반응", hint: "활동 중 아이들 대사" },
  { key: "teacher_praise", who: "teacher", label: "7. Teacher 칭찬·다음", hint: "칭찬 + 다음 활동 예고" },
];

export function emptyDialogueSlot() {
  return { foundation: "", interactive: "", action: "" };
}

export function emptyActivityForm() {
  const slots = {};
  for (const s of ACTIVITY_DIALOGUE_SLOTS) slots[s.key] = emptyDialogueSlot();
  return {
    title: "",
    titleEn: "",
    time: "",
    tip: "",
    slots,
  };
}

function slotHasText(slot) {
  if (!slot) return false;
  return Boolean(String(slot.foundation || "").trim() || String(slot.interactive || "").trim());
}

function compileSlotToLine(who, slot) {
  const foundation = String(slot?.foundation || "").trim();
  const interactive = String(slot?.interactive || "").trim();
  const action = String(slot?.action || "").trim();
  if (!foundation && !interactive) return null;
  return {
    who,
    action,
    lines: {
      foundation: foundation || interactive,
      interactive: interactive || foundation,
    },
  };
}

/** 활동 폼 1개 → brick 스타일 activity 객체 */
export function compileActivityForm(act, idx) {
  const title = String(act?.title || "").trim() || `활동 ${idx + 1}`;
  const titleEn = String(act?.titleEn || "").trim();
  const time = String(act?.time || "").trim();
  const tip = String(act?.tip || "").trim();
  const slots = act?.slots || {};

  const script = [];
  for (const def of ACTIVITY_DIALOGUE_SLOTS) {
    const line = compileSlotToLine(def.who, slots[def.key]);
    if (line) script.push(line);
  }

  if (!script.length) return null;

  return {
    id: `act-${idx + 1}`,
    num: idx + 1,
    title,
    ...(titleEn ? { titleEn } : {}),
    ...(time ? { time } : {}),
    script,
    ...(tip ? { tip } : {}),
  };
}

/** 폼 상태 → content_json (activities, 벽돌급 script[] 구조) */
export function buildActivitiesContentJson({
  introFoundation = "",
  introInteractive = "",
  activities = [],
  closingFoundation = "",
  closingInteractive = "",
  safetyText = "",
}) {
  const teacherLine = (foundation, interactive, action = "") => ({
    who: "teacher",
    action,
    lines: {
      foundation: String(foundation || "").trim(),
      interactive: String(interactive || "").trim(),
    },
  });

  const introF = introFoundation.trim();
  const introI = introInteractive.trim();
  const intro = (introF || introI)
    ? {
      title: "오프닝",
      script: [teacherLine(introF || introI, introI || introF, "소개")],
    }
    : null;

  const closingF = closingFoundation.trim();
  const closingI = closingInteractive.trim();
  const closing = (closingF || closingI)
    ? {
      title: "마무리",
      script: [teacherLine(closingF || closingI, closingI || closingF, "마무리")],
    }
    : null;

  const mappedActivities = activities
    .map((act, idx) => compileActivityForm(act, idx))
    .filter(Boolean);

  const safety = String(safetyText || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  return {
    intro,
    activities: mappedActivities,
    closing,
    safety: safety.length ? safety : undefined,
    introTagSuffix: "",
  };
}

/** 활동에 대화/제목이 하나라도 있는지 (저장 전 검증용) */
export function activityFormHasContent(act) {
  if (!act) return false;
  if (String(act.title || "").trim()) return true;
  if (String(act.titleEn || "").trim()) return true;
  if (String(act.tip || "").trim()) return true;
  return ACTIVITY_DIALOGUE_SLOTS.some(def => slotHasText(act.slots?.[def.key]));
}
