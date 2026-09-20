import { scheduleSupabase } from "./api.js";
import { yearMonthFirstDay, yearMonthLastDay } from "./constants.js";

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
  reviewed_by, reviewed_at, created_at, updated_at
`.replace(/\s+/g, " ").trim();

function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /schema cache|does not exist|could not find the table/i.test(error.message || "");
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
    if (payrollEntryIds?.length) q = q.in("payroll_entry_id", payrollEntryIds);
    if (fromDate) q = q.gte("class_date", fromDate);
    if (toDate) q = q.lte("class_date", toDate);
    q = applyYearMonth(q, yearMonth);
    return q;
  };

  const { data, error } = await build(REPORT_SELECT);
  if (!error) {
    return {
      rows: (data || []).map(normalizeReport),
      missingTable: false,
    };
  }
  if (isMissingTableError(error)) {
    return { rows: [], missingTable: true };
  }

  const fallback = await build(REPORT_SELECT_PLAIN);
  if (fallback.error) {
    if (isMissingTableError(fallback.error)) return { rows: [], missingTable: true };
    throw fallback.error;
  }
  return {
    rows: (fallback.data || []).map(normalizeReport),
    missingTable: false,
  };
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
  const { rows, missingTable } = await fetchClassIncidentReports({ limit: 1 });
  return { row: rows[0] || null, missingTable };
}

export async function upsertClassIncidentReport({
  id,
  payroll_entry_id,
  teacher_id,
  institution_id,
  class_date,
  body,
}) {
  const text = String(body || "").trim();
  if (!text) throw new Error("특이사항 내용을 입력해주세요.");

  if (id) {
    const { data, error } = await scheduleSupabase
      .from("class_incident_reports")
      .update({ body: text, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(REPORT_SELECT_PLAIN)
      .single();
    if (error) throw error;
    return normalizeReport(data);
  }

  const { data, error } = await scheduleSupabase
    .from("class_incident_reports")
    .insert({
      payroll_entry_id,
      teacher_id,
      institution_id: institution_id || null,
      class_date: class_date ? String(class_date).slice(0, 10) : null,
      body: text,
      status: CLASS_INCIDENT_STATUS.needs_review,
    })
    .select(REPORT_SELECT_PLAIN)
    .single();
  if (error) throw error;
  return normalizeReport(data);
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

export function buildClassIncidentFeedItem(latestRow, pendingCount = 0) {
  const pending = Number(pendingCount) || 0;
  return {
    id: CLASS_INCIDENT_FEED_ID,
    source: "class_incident",
    type: "class_incident",
    title: pending > 0 ? `수업 특이사항 · 확인 필요 ${pending}건` : "수업 특이사항",
    subtitle: pending > 0
      ? formatIncidentSubtitle(latestRow)
      : (latestRow ? formatIncidentSubtitle(latestRow) : "확인이 필요한 보고가 없습니다"),
    createdAt: latestRow?.created_at || latestRow?.updated_at || null,
    pinned: pending > 0,
    scopeLabel: "스케줄 관리자",
    scopeTone: "schedule_admins",
    raw: { kind: "class-incident-log", pendingCount: pending },
  };
}
