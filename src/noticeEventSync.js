import { createClient } from "@supabase/supabase-js";
import {
  deleteScheduleException,
  fetchInstitutions,
  saveScheduleException,
} from "./schedule/api.js";
import { resolveAudiencePersistFields } from "./noticeAudience.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export const NOTICE_KIND_OPTIONS = [
  { value: "normal", label: "일반" },
  { value: "important", label: "공고" },
  { value: "event", label: "행사" },
];

export function noticeToKind(notice) {
  if (notice?.notice_type === "event") return "event";
  if (notice?.importance === "important") return "important";
  return "normal";
}

/**
 * @param {string} kind
 * @param {object} event — start_date, end_date, exception_type, institution_id, note, event_time, event_location
 * @param {object} [audience] — audience_type, institution_id, audience_teacher_ids
 */
export function kindToNoticeFields(kind, event = {}, audience = {}) {
  const { audience_type, audience_teacher_ids, institution_id } =
    resolveAudiencePersistFields(audience, event, kind);

  if (kind === "event") {
    const start = event.start_date || event.event_date || null;
    const endRaw = event.end_date || event.event_end_date || null;
    const end = endRaw && start && endRaw !== start ? endRaw : null;
    return {
      notice_type: "event",
      importance: "normal",
      institution_id,
      audience_type,
      audience_teacher_ids,
      event_date: start,
      event_end_date: end,
      exception_type: event.exception_type || "event",
      event_time: event.event_time?.trim() || null,
      event_location: event.event_location?.trim() || null,
    };
  }
  return {
    notice_type: "general",
    importance: kind === "important" ? "important" : "normal",
    institution_id,
    audience_type,
    audience_teacher_ids,
    event_date: null,
    event_end_date: null,
    exception_type: null,
    event_time: null,
    event_location: null,
    schedule_exception_ids: [],
  };
}

/** "14:00" 또는 "14:00-16:00" → { start, end } */
export function parseEventTimeRange(value) {
  const raw = String(value || "").trim();
  if (!raw) return { start: null, end: null };
  const parts = raw.split("-").map(s => s.trim());
  const normalize = (t) => {
    if (!t) return null;
    if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`.replace(/^(\d):/, "0$1:");
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) return t.replace(/^(\d):/, "0$1:");
    return t;
  };
  return {
    start: normalize(parts[0]),
    end: parts[1] ? normalize(parts[1]) : null,
  };
}

export function buildEventExceptionNote(notice) {
  const parts = [notice.title?.trim() || notice.body?.trim() || "행사"];
  if (notice.event_time?.trim()) parts.push(notice.event_time.trim());
  if (notice.event_location?.trim()) parts.push(notice.event_location.trim());
  return parts.join(" · ");
}

async function deleteLinkedExceptions(notice) {
  const ids = notice?.schedule_exception_ids || [];
  if (ids.length) {
    await Promise.all(ids.map(id => deleteScheduleException(id).catch(() => {})));
  }
  if (notice?.id) {
    const { data } = await supabase
      .from("institution_schedule_exceptions")
      .select("id")
      .eq("notice_id", notice.id);
    if (data?.length) {
      await Promise.all(data.map(row => deleteScheduleException(row.id).catch(() => {})));
    }
  }
}

/**
 * 행사 공지 → institution_schedule_exceptions 동기화
 * institution_id 있으면 해당 원만, 없으면 전체 활성 원
 */
export async function syncNoticeEventSchedule(notice) {
  if (notice.notice_type !== "event" || !notice.event_date) {
    await deleteLinkedExceptions(notice);
    return [];
  }

  await deleteLinkedExceptions(notice);

  let institutions;
  if (notice.institution_id) {
    institutions = [{ id: notice.institution_id }];
  } else {
    institutions = await fetchInstitutions({ activeOnly: true });
  }
  if (!institutions.length) {
    throw new Error("등록된 원이 없어 행사 일정을 저장할 수 없습니다.");
  }

  const { start, end } = parseEventTimeRange(notice.event_time);
  const note = buildEventExceptionNote(notice);
  const endDate = notice.event_end_date
    && notice.event_end_date !== notice.event_date
    ? notice.event_end_date
    : null;
  const exceptionType = ["cancelled", "event", "time_change"].includes(notice.exception_type)
    ? notice.exception_type
    : "event";
  const ids = [];

  for (const inst of institutions) {
    const payload = {
      institution_id: inst.id,
      exception_date: notice.event_date,
      end_date: endDate,
      exception_type: exceptionType,
      note,
      adjusted_start_time: start,
      adjusted_end_time: end,
      event_location: notice.event_location?.trim() || null,
      notice_id: notice.id,
    };
    const row = await saveScheduleException(payload);
    if (row?.id) ids.push(row.id);
  }

  await supabase
    .from("notices")
    .update({ schedule_exception_ids: ids })
    .eq("id", notice.id);

  return ids;
}

export async function deleteNoticeEventSchedule(notice) {
  await deleteLinkedExceptions(notice);
}

export function formatEventSummary(notice) {
  if (notice?.notice_type !== "event") return "";
  const parts = [];
  if (notice.event_date) {
    const d = new Date(`${notice.event_date}T12:00:00`);
    let range = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    if (notice.event_end_date && notice.event_end_date !== notice.event_date) {
      const e = new Date(`${notice.event_end_date}T12:00:00`);
      range += ` ~ ${e.getMonth() + 1}월 ${e.getDate()}일`;
    }
    parts.push(range);
  }
  if (notice.event_time?.trim()) parts.push(notice.event_time.trim());
  if (notice.event_location?.trim()) parts.push(notice.event_location.trim());
  return parts.join(" · ");
}
