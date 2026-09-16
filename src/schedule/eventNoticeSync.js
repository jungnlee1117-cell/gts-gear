import { scheduleSupabase } from "./api.js";

export const SCHEDULE_EVENT_NOTICE_SOURCE = "schedule_event";

export function isScheduleEventNotice(exception) {
  return exception?.notices?.body_style?.source === SCHEDULE_EVENT_NOTICE_SOURCE;
}

export async function attachScheduleEventNoticeMetadata(exceptions) {
  const rows = exceptions || [];
  const noticeIds = [...new Set(rows.map(row => row.notice_id).filter(Boolean))];
  if (!noticeIds.length) return rows;
  const { data, error } = await scheduleSupabase
    .from("notices")
    .select("id, body_style, schedule_exception_ids")
    .in("id", noticeIds);
  if (error) throw error;
  const noticesById = new Map((data || []).map(notice => [notice.id, notice]));
  return rows.map(row => ({
    ...row,
    notices: row.notice_id ? noticesById.get(row.notice_id) || null : null,
  }));
}

function noticeFields(payload) {
  return {
    title: payload.note?.trim() || "행사",
    importance: "normal",
    notice_type: "event",
    event_date: payload.exception_date,
    event_end_date: payload.end_date || null,
    institution_id: payload.institution_id,
    exception_type: payload.exception_type || "event",
    audience_type: "institution_teachers",
    audience_teacher_ids: [],
  };
}

export async function createScheduleEventNotice(payload, author) {
  const { data, error } = await scheduleSupabase
    .from("notices")
    .insert({
      ...noticeFields(payload),
      body: "",
      body_style: {
        font: "sans",
        size: "medium",
        source: SCHEDULE_EVENT_NOTICE_SOURCE,
      },
      author_id: author?.id || null,
      author_name: author?.name || null,
      schedule_exception_ids: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateScheduleEventNotice(noticeId, payload) {
  if (!noticeId) return null;
  const { data, error } = await scheduleSupabase
    .from("notices")
    .update({
      ...noticeFields(payload),
      updated_at: new Date().toISOString(),
    })
    .eq("id", noticeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function linkScheduleExceptionToNotice(noticeId, exceptionId) {
  if (!noticeId || !exceptionId) return;
  const { error } = await scheduleSupabase
    .from("notices")
    .update({ schedule_exception_ids: [exceptionId] })
    .eq("id", noticeId);
  if (error) throw error;
}

export async function deleteScheduleEventNotice(noticeId) {
  if (!noticeId) return;
  const { error } = await scheduleSupabase
    .from("notices")
    .delete()
    .eq("id", noticeId);
  if (error) throw error;
}
