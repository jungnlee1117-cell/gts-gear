import { sendPushEvent } from "../pushNotifications.js";
import { scheduleSupabase } from "./api.js";
import { yearMonthFirstDay, yearMonthLastDay } from "./constants.js";
import { INCIDENT_CATEGORY, isSafetyIncident } from "./classIncidentCategories.js";

export const CLASS_INCIDENT_STATUS = {
  needs_review: "needs_review",
  reviewed: "reviewed",
};

export const CLASS_INCIDENT_STATUS_LABEL = {
  needs_review: "확인 필요",
  reviewed: "확인 완료",
};

export const CLASS_INCIDENT_FEED_ID = "class-incident-log";
export const CLASS_INCIDENT_PREVIEW_LIMIT = 20;
export const CLASS_INCIDENT_SQL_HINT =
  "수업 특이사항 기능을 위한 데이터베이스 업데이트가 필요합니다. supabase/class_incident_reports.sql 을 실행해 주세요.";

const REPORT_SELECT = `
  id, payroll_entry_id, teacher_id, institution_id, class_date, body, status,
  incident_category, incident_subtype, substitute_teacher_id,
  changed_start_time, changed_end_time,
  reviewed_by, reviewed_at, created_at, updated_at,
  teachers!class_incident_reports_teacher_id_fkey(id, name),
  substitute_teacher:teachers!class_incident_reports_substitute_teacher_id_fkey(id, name),
  institutions(id, name),
  payroll_entries(id, minutes, pay_type, entry_status, class_date, teacher_id),
  class_incident_replies(
    id, report_id, author_id, body, created_at,
    teachers!class_incident_replies_author_id_fkey(id, name, role)
  )
`.replace(/\s+/g, " ").trim();

const REPORT_SELECT_NO_SUBSTITUTE_JOIN = `
  id, payroll_entry_id, teacher_id, institution_id, class_date, body, status,
  incident_category, incident_subtype, substitute_teacher_id,
  changed_start_time, changed_end_time,
  reviewed_by, reviewed_at, created_at, updated_at,
  teachers!class_incident_reports_teacher_id_fkey(id, name),
  institutions(id, name),
  payroll_entries(id, minutes, pay_type, entry_status, class_date, teacher_id),
  class_incident_replies(
    id, report_id, author_id, body, created_at,
    teachers!class_incident_replies_author_id_fkey(id, name, role)
  )
`.replace(/\s+/g, " ").trim();

const REPORT_SELECT_LEGACY = `
  id, payroll_entry_id, teacher_id, institution_id, class_date, body, status,
  reviewed_by, reviewed_at, created_at, updated_at,
  teachers!class_incident_reports_teacher_id_fkey(id, name),
  institutions(id, name),
  payroll_entries(id, minutes, pay_type, entry_status, class_date, teacher_id),
  class_incident_replies(
    id, report_id, author_id, body, created_at,
    teachers!class_incident_replies_author_id_fkey(id, name, role)
  )
`.replace(/\s+/g, " ").trim();

const REPORT_SELECT_PLAIN = `
  id, payroll_entry_id, teacher_id, institution_id, class_date, body, status,
  incident_category, incident_subtype, substitute_teacher_id,
  changed_start_time, changed_end_time,
  reviewed_by, reviewed_at, created_at, updated_at
`.replace(/\s+/g, " ").trim();

const REPORT_SELECT_PLAIN_LEGACY = `
  id, payroll_entry_id, teacher_id, institution_id, class_date, body, status,
  reviewed_by, reviewed_at, created_at, updated_at
`.replace(/\s+/g, " ").trim();

function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /schema cache|does not exist|could not find the table/i.test(error.message || "");
}

function isMissingCategoryColumnError(error) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /incident_category|incident_subtype|substitute_teacher_id|changed_start_time|changed_end_time/i
    .test(error.message || "");
}

export function classIncidentErrorMessage(error) {
  const msg = String(error?.message || error || "").trim();
  if (!msg) return "특이사항을 저장하지 못했습니다.";
  if (isMissingTableError({ message: msg, code: error?.code })) return CLASS_INCIDENT_SQL_HINT;
  return msg;
}

function sortReplies(replies = []) {
  return [...(replies || [])].sort((a, b) => (
    new Date(a.created_at || 0) - new Date(b.created_at || 0)
  ));
}

function normalizeReport(row) {
  if (!row) return row;
  return {
    ...row,
    class_date: row.class_date ? String(row.class_date).slice(0, 10) : row.class_date,
    class_incident_replies: sortReplies(row.class_incident_replies),
  };
}

function applyYearMonth(q, yearMonth) {
  if (!yearMonth) return q;
  const from = yearMonthFirstDay(yearMonth);
  const to = yearMonthLastDay(yearMonth);
  return q.gte("class_date", from).lte("class_date", to);
}

export async function fetchClassIncidentReports({
  teacherId,
  institutionId,
  yearMonth,
  status,
  payrollEntryIds,
  fromDate,
  toDate,
  incidentCategory,
  limit = 400,
} = {}) {
  const build = (select) => {
    let q = scheduleSupabase
      .from("class_incident_reports")
      .select(select)
      .order("class_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (teacherId) q = q.eq("teacher_id", teacherId);
    if (institutionId) q = q.eq("institution_id", institutionId);
    if (status && status !== "all") q = q.eq("status", status);
    if (incidentCategory) q = q.eq("incident_category", incidentCategory);
    if (payrollEntryIds?.length) q = q.in("payroll_entry_id", payrollEntryIds);
    if (fromDate) q = q.gte("class_date", fromDate);
    if (toDate) q = q.lte("class_date", toDate);
    q = applyYearMonth(q, yearMonth);
    return q;
  };

  const selects = [REPORT_SELECT, REPORT_SELECT_NO_SUBSTITUTE_JOIN, REPORT_SELECT_LEGACY, REPORT_SELECT_PLAIN, REPORT_SELECT_PLAIN_LEGACY];
  let lastError = null;
  for (const select of selects) {
    const { data, error } = await build(select);
    if (!error) {
      return {
        rows: (data || []).map(normalizeReport),
        missingTable: false,
      };
    }
    lastError = error;
    if (isMissingTableError(error)) {
      return { rows: [], missingTable: true };
    }
    if (!isMissingCategoryColumnError(error) && !/relationship|substitute_teacher/i.test(error.message || "")) {
      break;
    }
  }
  if (isMissingTableError(lastError)) return { rows: [], missingTable: true };
  throw lastError;
}

export async function countClassIncidentsNeedingReview() {
  const { count, error } = await scheduleSupabase
    .from("class_incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", CLASS_INCIDENT_STATUS.needs_review);
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
  return count || 0;
}

export async function fetchLatestClassIncident() {
  const safety = await fetchClassIncidentReports({
    status: CLASS_INCIDENT_STATUS.needs_review,
    incidentCategory: INCIDENT_CATEGORY.safety,
    limit: 1,
  }).catch(() => ({ rows: [], missingTable: false }));
  if (safety.rows[0]) {
    return { row: safety.rows[0], missingTable: false };
  }
  const pending = await fetchClassIncidentReports({
    status: CLASS_INCIDENT_STATUS.needs_review,
    limit: 1,
  });
  if (pending.rows[0] || pending.missingTable) {
    return { row: pending.rows[0] || null, missingTable: pending.missingTable };
  }
  const { rows, missingTable } = await fetchClassIncidentReports({ limit: 1 });
  return { row: rows[0] || null, missingTable };
}

export async function countPendingSafetyIncidents() {
  const { count, error } = await scheduleSupabase
    .from("class_incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", CLASS_INCIDENT_STATUS.needs_review)
    .eq("incident_category", INCIDENT_CATEGORY.safety);
  if (error) {
    if (isMissingTableError(error) || isMissingCategoryColumnError(error)) return 0;
    throw error;
  }
  return count || 0;
}

function categoryWriteFields({
  incident_category,
  incident_subtype,
  substitute_teacher_id,
  changed_start_time,
  changed_end_time,
}) {
  return {
    incident_category: incident_category || null,
    incident_subtype: incident_subtype || null,
    substitute_teacher_id: substitute_teacher_id || null,
    changed_start_time: changed_start_time || null,
    changed_end_time: changed_end_time || null,
  };
}

async function writeReport(kind, payload, id) {
  const { incident_category, incident_subtype, substitute_teacher_id, changed_start_time, changed_end_time, ...legacy } = payload;
  const full = { ...legacy, ...categoryWriteFields(payload) };
  const attempts = [
    { payload: full, select: REPORT_SELECT_PLAIN },
    { payload: legacy, select: REPORT_SELECT_PLAIN_LEGACY },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    const query = kind === "update"
      ? scheduleSupabase.from("class_incident_reports").update(attempt.payload).eq("id", id)
      : scheduleSupabase.from("class_incident_reports").insert(attempt.payload);
    const { data, error } = await query.select(attempt.select).single();
    if (!error) return normalizeReport(data);
    lastError = error;
    if (!isMissingCategoryColumnError(error)) break;
  }
  throw lastError;
}

function notifyIncidentReported(row, notify = {}) {
  const teacherName = notify.teacher_name || row.teachers?.name || "선생님";
  const institutionName = notify.institution_name || row.institutions?.name || "";
  void sendPushEvent(scheduleSupabase, "class_incident_reported", {
    teacher_id: row.teacher_id,
    teacher_name: teacherName,
    institution_name: institutionName,
    class_date: row.class_date,
    incident_category: row.incident_category || notify.incident_category || null,
    incident_subtype: row.incident_subtype || notify.incident_subtype || null,
    body: row.body,
  });
}

export async function upsertClassIncidentReport({
  id,
  payroll_entry_id,
  teacher_id,
  institution_id,
  class_date,
  body,
  incident_category,
  incident_subtype,
  substitute_teacher_id,
  changed_start_time,
  changed_end_time,
  notify,
}) {
  const text = String(body || "").trim();
  if (!text) throw new Error("특이사항 내용을 입력해주세요.");

  const fields = {
    body: text,
    incident_category: incident_category || null,
    incident_subtype: incident_subtype || null,
    substitute_teacher_id: substitute_teacher_id || null,
    changed_start_time: changed_start_time || null,
    changed_end_time: changed_end_time || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const row = await writeReport("update", fields, id);
    if (isSafetyIncident(row) || incident_category === INCIDENT_CATEGORY.safety) {
      notifyIncidentReported(row, notify);
    }
    return row;
  }

  const row = await writeReport("insert", {
    payroll_entry_id,
    teacher_id,
    institution_id: institution_id || null,
    class_date: class_date ? String(class_date).slice(0, 10) : null,
    status: CLASS_INCIDENT_STATUS.needs_review,
    ...fields,
  });
  notifyIncidentReported(row, {
    ...notify,
    incident_category,
    incident_subtype,
  });
  return row;
}

export async function deleteClassIncidentReport(id) {
  const { error } = await scheduleSupabase
    .from("class_incident_reports")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function markClassIncidentReviewed(id, reviewerId) {
  const { data, error } = await scheduleSupabase
    .from("class_incident_reports")
    .update({
      status: CLASS_INCIDENT_STATUS.reviewed,
      reviewed_by: reviewerId || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(REPORT_SELECT_PLAIN)
    .single();
  if (error) throw error;
  return normalizeReport(data);
}

export async function addClassIncidentReply({ report_id, author_id, body }) {
  const text = String(body || "").trim();
  if (!text) throw new Error("답장 내용을 입력해주세요.");
  const { data, error } = await scheduleSupabase
    .from("class_incident_replies")
    .insert({
      report_id,
      author_id,
      body: text,
    })
    .select(`
      id, report_id, author_id, body, created_at,
      teachers!class_incident_replies_author_id_fkey(id, name, role)
    `)
    .single();
  if (!error) return data;

  const fallback = await scheduleSupabase
    .from("class_incident_replies")
    .insert({ report_id, author_id, body: text })
    .select("id, report_id, author_id, body, created_at")
    .single();
  if (fallback.error) throw fallback.error;
  return fallback.data;
}

export function reportsByPayrollEntryId(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.payroll_entry_id) map.set(row.payroll_entry_id, row);
  }
  return map;
}

export function formatIncidentDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

export function formatIncidentWhen(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}.${p(dt.getMonth() + 1)}.${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function formatIncidentSubtitle(row) {
  if (!row) return "선생님이 남긴 수업 특이사항";
  const teacher = row.teachers?.name || "선생님";
  const inst = row.institutions?.name;
  const date = formatIncidentDate(row.class_date);
  return [teacher, inst, date].filter(Boolean).join(" · ");
}

export function isClassIncidentLogItem(item) {
  return item?.source === "class_incident" || item?.raw?.kind === "class-incident-log";
}

export function buildClassIncidentFeedItem(latestRow, pendingCount = 0, safetyCount = 0) {
  const pending = Number(pendingCount) || 0;
  const safety = Number(safetyCount) || 0;
  const urgentSafety = safety > 0 || isSafetyIncident(latestRow);
  return {
    id: CLASS_INCIDENT_FEED_ID,
    source: "class_incident",
    type: "class_incident",
    title: urgentSafety
      ? (safety > 0 ? `안전사고 · 확인 필요 ${safety}건` : "안전사고 보고")
      : (pending > 0 ? `수업 특이사항 · 확인 필요 ${pending}건` : "수업 특이사항"),
    subtitle: pending > 0
      ? formatIncidentSubtitle(latestRow)
      : (latestRow ? formatIncidentSubtitle(latestRow) : "확인이 필요한 보고가 없습니다"),
    createdAt: latestRow?.created_at || latestRow?.updated_at || null,
    pinned: pending > 0 || urgentSafety,
    urgentSafety,
    scopeLabel: urgentSafety ? "즉시 확인" : "스케줄 관리자",
    scopeTone: urgentSafety ? "urgent" : "schedule_admins",
    raw: { kind: "class-incident-log", pendingCount: pending, safetyCount: safety },
  };
}
