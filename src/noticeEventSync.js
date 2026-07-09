import { createClient } from "@supabase/supabase-js";
import {
  deleteScheduleException,
  fetchInstitutions,
  saveScheduleException,
} from "./schedule/api.js";

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

export function kindToNoticeFields(kind, event = {}) {
  if (kind === "event") {
    return {
      notice_type: "event",
      importance: "normal",
      event_date: event.event_date || null,
      event_time: event.event_time?.trim() || null,
      event_location: event.event_location?.trim() || null,
    };
  }
  return {
    notice_type: "general",
    importance: kind === "important" ? "important" : "normal",
    event_date: null,
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
  const parts = [notice.title?.trim() || "행사"];
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
 * 행사 공지 → 전체 활성 원 institution_schedule_exceptions 생성
 * @returns {Promise<string[]>} exception ids
 */
export async function syncNoticeEventSchedule(notice) {
  if (notice.notice_type !== "event" || !notice.event_date) {
    await deleteLinkedExceptions(notice);
    return [];
  }

  await deleteLinkedExceptions(notice);

  const institutions = await fetchInstitutions({ activeOnly: true });
  if (!institutions.length) {
    throw new Error("등록된 원이 없어 행사 일정을 저장할 수 없습니다.");
  }

  const { start, end } = parseEventTimeRange(notice.event_time);
  const note = buildEventExceptionNote(notice);
  const ids = [];

  for (const inst of institutions) {
    const payload = {
      institution_id: inst.id,
      exception_date: notice.event_date,
      end_date: null,
      exception_type: "event",
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
    parts.push(`${d.getMonth() + 1}월 ${d.getDate()}일`);
  }
  if (notice.event_time?.trim()) parts.push(notice.event_time.trim());
  if (notice.event_location?.trim()) parts.push(notice.event_location.trim());
  return parts.join(" · ");
}
