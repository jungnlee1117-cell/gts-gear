import { resolveTeacherMonthlyGross } from "./additionalPayments.js";
import { createClient } from "@supabase/supabase-js";
import { yearMonthFirstDay, yearMonthLastDay } from "./constants.js";
import { buildMonthlyContractPayload, buildBulkRevenueDrafts, isMonthlyFixedBilling, isPerCapitaBilling, listBulkPrefillTargets, previousYearMonth } from "./monthlyBilling.js";
import {
  computeInstitutionInstructorCost,
  applyManagerShareAdjustments,
  sumMergedAdditionalPayments,
} from "./institutionTeacherPay.js";
import { buildTempTeacherPayrollRows, engagementOverlapsMonth } from "./temporaryTeachers.js";
import { groupSubstituteLessonsByTempTeacher } from "./substituteLessons.js";
import { sumOneoffCustomPayAdjustments } from "./oneoffLessons.js";
import {
  computeSettlement,
  estimateTeacherPayByEntry,
  resolveInstitutionRevenue,
} from "./settlement.js";
import { resolveSettlementContractType } from "./thresholdSplitSettlement.js";
import {
  countSkippedEntries,
  countUnconfirmedDays,
  expandMonthSchedule,
  groupPayrollByTypeConfirmed,
} from "./payrollCalendar.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const scheduleSupabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/** App.jsx 세션과 schedule 클라이언트 동기화 (RLS 인증 보장) */
export async function syncScheduleAuthSession(session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const { error } = await scheduleSupabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
}

/** patch_28 미적용 DB 등 — 테이블/뷰 없음(PGRST205) */
function isSchemaMissingError(error) {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  return /could not find the table|relation .* does not exist/i.test(error.message || "");
}

async function enrichWeeklySlotsWithInstitutions(slots) {
  if (!slots?.length) return slots;

  const missingIds = [...new Set(
    slots
      .filter(s => s.institution_id && !s.institutions?.name)
      .map(s => s.institution_id),
  )];
  if (!missingIds.length) return slots;

  const nameById = new Map();
  for (const slot of slots) {
    if (slot.institution_id && slot.institutions?.name) {
      nameById.set(slot.institution_id, slot.institutions);
    }
  }

  const { data: adminInsts, error: adminErr } = await scheduleSupabase
    .from("institutions")
    .select("id, name, address, parking_info")
    .in("id", missingIds);
  if (!adminErr) {
    for (const inst of adminInsts || []) nameById.set(inst.id, inst);
  }

  const stillMissing = missingIds.filter(id => !nameById.has(id));
  if (stillMissing.length) {
    const { data: assigned, error: rpcErr } = await scheduleSupabase
      .rpc("get_teacher_assigned_institutions");
    if (!rpcErr) {
      for (const inst of assigned || []) {
        if (stillMissing.includes(inst.id)) nameById.set(inst.id, inst);
      }
    }
  }

  return slots.map(slot => {
    if (slot.institutions?.name || !slot.institution_id) return slot;
    const inst = nameById.get(slot.institution_id);
    return inst ? { ...slot, institutions: inst } : slot;
  });
}

export async function fetchTeachers() {
  const { data, error } = await scheduleSupabase
    .from("teachers")
    .select("id, name, role, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function fetchTemporaryEngagementsForMonth(yearMonth) {
  const { data, error } = await scheduleSupabase
    .from("temp_teachers")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return (data || []).filter(eng => engagementOverlapsMonth(eng, yearMonth));
}

export async function fetchTemporaryEngagements() {
  const { data, error } = await scheduleSupabase
    .from("temp_teachers")
    .select("*")
    .eq("is_active", true)
    .order("engagement_start_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

function normalizeTempTeacherPayFields({ pay_mode, rate_amount, work_hours, work_days }) {
  const mode = pay_mode;
  const rate = Math.round(Number(rate_amount) || 0);
  if (mode === "fixed_total") {
    return { pay_mode: mode, rate_amount: rate, work_hours: null, work_days: null };
  }
  if (mode === "daily") {
    return {
      pay_mode: mode,
      rate_amount: rate,
      work_hours: null,
      work_days: Math.round(Number(work_days) || 0) || null,
    };
  }
  if (mode === "hourly") {
    const hours = Number(work_hours);
    return {
      pay_mode: mode,
      rate_amount: rate,
      work_hours: Number.isFinite(hours) && hours > 0 ? hours : null,
      work_days: null,
    };
  }
  return {
    pay_mode: mode,
    rate_amount: rate,
    work_hours: null,
    work_days: null,
  };
}

export async function registerTemporaryTeacher({
  name,
  phone = "",
  bank_name = "",
  bank_account = "",
  institution_id,
  pay_mode,
  rate_amount,
  pay_type = "정규",
  is_substitute = false,
  substitute_teacher_id = null,
  substitute_start_date = null,
  substitute_end_date = null,
  engagement_start_date,
  engagement_end_date = null,
  work_hours = null,
  work_days = null,
  created_by,
}) {
  const payFields = normalizeTempTeacherPayFields({ pay_mode, rate_amount, work_hours, work_days });
  const { data, error } = await scheduleSupabase
    .from("temp_teachers")
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      bank_name: bank_name.trim(),
      bank_account: bank_account.trim(),
      institution_id,
      ...payFields,
      pay_type,
      is_substitute: Boolean(is_substitute),
      substitute_teacher_id: is_substitute ? substitute_teacher_id : null,
      substitute_start_date: is_substitute ? substitute_start_date : null,
      substitute_end_date: is_substitute ? substitute_end_date : null,
      engagement_start_date,
      engagement_end_date: engagement_end_date || null,
      created_by: created_by || null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSubstituteAssignmentsForTeacher(teacherId, fromDate, toDate) {
  if (!teacherId) return [];
  const { data, error } = await scheduleSupabase
    .from("temp_teachers")
    .select("*")
    .eq("is_active", true)
    .eq("is_substitute", true)
    .eq("substitute_teacher_id", teacherId)
    .lte("substitute_start_date", toDate)
    .or(`substitute_end_date.is.null,substitute_end_date.gte.${fromDate}`);
  if (error) throw error;
  return data || [];
}

async function enrichSubstituteLessons(rows) {
  if (!rows?.length) return [];
  const teacherIds = new Set();
  const tempIds = new Set();
  const instIds = new Set();
  for (const row of rows) {
    if (row.original_teacher_id) teacherIds.add(row.original_teacher_id);
    if (row.substitute_teacher_id) teacherIds.add(row.substitute_teacher_id);
    if (row.substitute_temp_teacher_id) tempIds.add(row.substitute_temp_teacher_id);
    if (row.institution_id) instIds.add(row.institution_id);
  }
  const teachersById = new Map();
  const tempById = new Map();
  const instById = new Map();
  if (teacherIds.size) {
    const { data, error } = await scheduleSupabase
      .from("teachers")
      .select("id, name")
      .in("id", [...teacherIds]);
    if (error) throw error;
    (data || []).forEach(t => teachersById.set(t.id, t));
  }
  if (tempIds.size) {
    const { data, error } = await scheduleSupabase
      .from("temp_teachers")
      .select("*")
      .in("id", [...tempIds]);
    if (error) throw error;
    (data || []).forEach(t => tempById.set(t.id, t));
  }
  if (instIds.size) {
    const { data, error } = await scheduleSupabase
      .from("institutions")
      .select("id, name")
      .in("id", [...instIds]);
    if (error) throw error;
    (data || []).forEach(i => instById.set(i.id, i));
  }
  return rows.map(row => ({
    ...row,
    original_teacher: teachersById.get(row.original_teacher_id) || null,
    substitute_teacher: row.substitute_teacher_id
      ? teachersById.get(row.substitute_teacher_id) || null
      : null,
    substitute_temp_teacher: row.substitute_temp_teacher_id
      ? tempById.get(row.substitute_temp_teacher_id) || null
      : null,
    institutions: instById.get(row.institution_id) || null,
  }));
}

export async function fetchSubstituteLessons({ fromDate, toDate, teacherId, yearMonth } = {}) {
  let q = scheduleSupabase
    .from("substitute_lessons")
    .select("*")
    .order("lesson_date", { ascending: true });
  if (fromDate) q = q.gte("lesson_date", fromDate);
  if (toDate) q = q.lte("lesson_date", toDate);
  if (yearMonth) {
    q = q
      .gte("lesson_date", yearMonthFirstDay(yearMonth))
      .lte("lesson_date", yearMonthLastDay(yearMonth));
  }
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (teacherId) {
    rows = rows.filter(r =>
      r.original_teacher_id === teacherId
      || r.substitute_teacher_id === teacherId,
    );
  }
  return enrichSubstituteLessons(rows);
}

export async function insertSubstituteLesson(row) {
  const { data, error } = await scheduleSupabase
    .from("substitute_lessons")
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  const [enriched] = await enrichSubstituteLessons([data]);
  return enriched;
}

export async function updateSubstituteLessonStatus(id, status) {
  const { data, error } = await scheduleSupabase
    .from("substitute_lessons")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const [enriched] = await enrichSubstituteLessons([data]);
  return enriched;
}

export async function findPayrollEntryBySlot({ teacher_id, class_date, schedule_slot_id }) {
  if (!teacher_id || !class_date || !schedule_slot_id) return null;
  const { data, error } = await scheduleSupabase
    .from("payroll_entries")
    .select("id")
    .eq("teacher_id", teacher_id)
    .eq("class_date", class_date)
    .eq("schedule_slot_id", schedule_slot_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function enrichOneoffLessons(rows) {
  if (!rows?.length) return [];
  const instIds = [...new Set(rows.map(r => r.institution_id).filter(Boolean))];
  const instById = new Map();
  if (instIds.length) {
    const { data, error } = await scheduleSupabase
      .from("institutions")
      .select("id, name")
      .in("id", instIds);
    if (error) throw error;
    (data || []).forEach(i => instById.set(i.id, i));
  }
  return rows.map(row => ({
    ...row,
    institutions: instById.get(row.institution_id) || null,
  }));
}

export async function fetchOneoffLessons({ fromDate, toDate, teacherId, yearMonth } = {}) {
  let q = scheduleSupabase
    .from("oneoff_lessons")
    .select("*")
    .order("lesson_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (fromDate) q = q.gte("lesson_date", fromDate);
  if (toDate) q = q.lte("lesson_date", toDate);
  if (yearMonth) {
    q = q
      .gte("lesson_date", yearMonthFirstDay(yearMonth))
      .lte("lesson_date", yearMonthLastDay(yearMonth));
  }
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw error;
  }
  return enrichOneoffLessons(data || []);
}

export async function insertOneoffLesson(row) {
  const { data, error } = await scheduleSupabase
    .from("oneoff_lessons")
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  const [enriched] = await enrichOneoffLessons([data]);
  return enriched;
}

export async function updateOneoffLesson(id, patch) {
  const { data, error } = await scheduleSupabase
    .from("oneoff_lessons")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const [enriched] = await enrichOneoffLessons([data]);
  return enriched;
}

export async function updateTempTeacher(id, payload) {
  const payFields = normalizeTempTeacherPayFields(payload);
  const { data, error } = await scheduleSupabase
    .from("temp_teachers")
    .update({
      name: payload.name.trim(),
      phone: (payload.phone || "").trim(),
      bank_name: (payload.bank_name || "").trim(),
      bank_account: (payload.bank_account || "").trim(),
      institution_id: payload.institution_id,
      ...payFields,
      pay_type: payload.pay_type,
      is_substitute: Boolean(payload.is_substitute),
      substitute_teacher_id: payload.is_substitute ? payload.substitute_teacher_id : null,
      substitute_start_date: payload.is_substitute ? payload.substitute_start_date : null,
      substitute_end_date: payload.is_substitute ? payload.substitute_end_date : null,
      engagement_start_date: payload.engagement_start_date,
      engagement_end_date: payload.engagement_end_date || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchInstitutions({ activeOnly = true, teacherScope = false } = {}) {
  if (teacherScope) {
    const { data, error } = await scheduleSupabase.rpc("get_teacher_assigned_institutions");
    if (error) throw error;
    const rows = data || [];
    return activeOnly ? rows.filter(i => i.is_active !== false) : rows;
  }
  let q = scheduleSupabase.from("institutions").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchInstitution(id) {
  const { data, error } = await scheduleSupabase
    .from("institutions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertInstitution(payload) {
  if (payload.id) {
    const { data, error } = await scheduleSupabase
      .from("institutions")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", payload.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("institutions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAssignments(institutionId, { activeOnly = true, role = null } = {}) {
  let q = scheduleSupabase
    .from("institution_teacher_assignments")
    .select("*, teachers(id, name)")
    .order("created_at", { ascending: false });
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (activeOnly) q = q.eq("is_active", true);
  if (role) q = q.eq("role", role);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveAssignment({ institution_id, teacher_id, pay_types, role = "teacher" }) {
  const row = {
    institution_id,
    teacher_id,
    pay_types: pay_types || [],
    is_active: true,
    role: role === "manager" ? "manager" : "teacher",
  };
  let { data, error } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .upsert(row, { onConflict: "institution_id,teacher_id" })
    .select("*, teachers(id, name)")
    .single();
  if (error && /role|column/i.test(error.message || "")) {
    const { role: _omit, ...fallback } = row;
    ({ data, error } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .upsert(fallback, { onConflict: "institution_id,teacher_id" })
      .select("*, teachers(id, name)")
      .single());
  }
  if (error) throw error;
  return data;
}

/**
 * 기관 담당 관리자(manager_id) 변경.
 * 수업 시간표·수업 선생님 배정은 건드리지 않음.
 */
export async function changeInstitutionManager({ institutionId, managerId }) {
  if (!institutionId) throw new Error("기관이 없습니다.");
  const nextId = managerId || null;

  const { data: before, error: beforeErr } = await scheduleSupabase
    .from("institutions")
    .select("id, name, manager_id")
    .eq("id", institutionId)
    .single();
  if (beforeErr) throw beforeErr;

  const { data: updated, error } = await scheduleSupabase
    .from("institutions")
    .update({ manager_id: nextId, updated_at: new Date().toISOString() })
    .eq("id", institutionId)
    .select("*")
    .single();
  if (error) throw error;

  // 이전 manager 전용 배정 행 비활성 (수업 teacher 행은 유지)
  if (before.manager_id && before.manager_id !== nextId) {
    await scheduleSupabase
      .from("institution_teacher_assignments")
      .update({ is_active: false })
      .eq("institution_id", institutionId)
      .eq("teacher_id", before.manager_id)
      .eq("role", "manager");
  }

  // 새 담당자 — 수업 선생님으로 이미 있으면 유지, 없으면 manager 행 추가
  if (nextId) {
    const { data: existing } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .select("id, role, is_active")
      .eq("institution_id", institutionId)
      .eq("teacher_id", nextId)
      .maybeSingle();

    if (!existing) {
      await scheduleSupabase.from("institution_teacher_assignments").insert({
        institution_id: institutionId,
        teacher_id: nextId,
        pay_types: [],
        is_active: true,
        role: "manager",
      });
    } else if (existing.role === "manager" && !existing.is_active) {
      await scheduleSupabase
        .from("institution_teacher_assignments")
        .update({ is_active: true })
        .eq("id", existing.id);
    }
  }

  return { before, updated };
}

export async function deactivateAssignment(id) {
  const { error } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}

/** @deprecated hard delete — prefer deactivateAssignment */
export async function deleteAssignment(id) {
  return deactivateAssignment(id);
}

export async function fetchWeeklySchedule(institutionId, teacherId) {
  let q = scheduleSupabase
    .from("institution_weekly_schedule")
    .select("*, institutions(id, name, address, parking_info)")
    .order("day_of_week")
    .order("sort_order");
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) throw error;
  const slots = data || [];
  if (!teacherId) return slots;
  return enrichWeeklySlotsWithInstitutions(slots);
}

export async function saveWeeklySlot(payload) {
  const row = {
    institution_id: payload.institution_id,
    teacher_id: payload.teacher_id || null,
    day_of_week: Number(payload.day_of_week),
    class_type: payload.class_type,
    start_time: payload.start_time,
    end_time: payload.end_time,
    label: payload.label ?? null,
    sort_order: payload.sort_order ?? 0,
  };
  if ("effective_from" in payload) {
    row.effective_from = payload.effective_from
      ? String(payload.effective_from).slice(0, 10)
      : null;
  }
  if ("effective_to" in payload) {
    row.effective_to = payload.effective_to
      ? String(payload.effective_to).slice(0, 10)
      : null;
  }
  if (payload.id) {
    const { data, error } = await scheduleSupabase
      .from("institution_weekly_schedule")
      .update(row)
      .eq("id", payload.id)
      .select("*, institutions(id, name, address, parking_info)")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .insert(row)
    .select("*, institutions(id, name, address, parking_info)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeeklySlot(id) {
  const { error } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchScheduleExceptions(institutionId, fromDate, toDate) {
  let q = scheduleSupabase
    .from("institution_schedule_exceptions")
    .select("*, institutions(id, name)")
    .order("exception_date");
  if (institutionId) q = q.eq("institution_id", institutionId);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (fromDate && toDate) {
    rows = rows.filter(ex => {
      const end = ex.end_date || ex.exception_date;
      return ex.exception_date <= toDate && end >= fromDate;
    });
  }
  return rows;
}

export async function saveScheduleException(payload) {
  const { data, error } = await scheduleSupabase
    .from("institution_schedule_exceptions")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteScheduleException(id) {
  const { error } = await scheduleSupabase
    .from("institution_schedule_exceptions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchHomeVisitPatterns({ teacherId, status } = {}) {
  let q = scheduleSupabase
    .from("home_visit_patterns")
    .select("*, teachers(id, name)")
    .order("status")
    .order("pattern_start_date", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertHomeVisitPattern(payload) {
  const row = {
    teacher_id: payload.teacher_id,
    student_name: payload.student_name?.trim() || "",
    student_birth_date: payload.student_birth_date || null,
    parent_contact: payload.parent_contact?.trim() || null,
    location: payload.location?.trim() || null,
    day_of_week: Number(payload.day_of_week),
    start_time: payload.start_time,
    end_time: payload.end_time || null,
    pattern_start_date: payload.pattern_start_date,
    pattern_end_date: payload.pattern_end_date || null,
    status: payload.status || "active",
    note: payload.note?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (!row.student_name) throw new Error("학생 이름을 입력해주세요.");
  if (payload.id) {
    const { data, error } = await scheduleSupabase
      .from("home_visit_patterns")
      .update(row)
      .eq("id", payload.id)
      .select("*, teachers(id, name)")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("home_visit_patterns")
    .insert(row)
    .select("*, teachers(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function endHomeVisitPattern(id, endDate) {
  const { data, error } = await scheduleSupabase
    .from("home_visit_patterns")
    .update({
      status: "ended",
      pattern_end_date: endDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*, teachers(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHomeVisitPattern(id) {
  const { error } = await scheduleSupabase
    .from("home_visit_patterns")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchMonthlyContracts(institutionId) {
  let q = scheduleSupabase
    .from("institution_monthly_contracts")
    .select("*")
    .order("year_month", { ascending: false });
  if (institutionId) q = q.eq("institution_id", institutionId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveMonthlyContract(payload) {
  const { data, error } = await scheduleSupabase
    .from("institution_monthly_contracts")
    .upsert(payload, { onConflict: "institution_id,year_month" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bulkApplyPreviousMonthContracts(yearMonth) {
  const [institutions, contracts] = await Promise.all([
    fetchInstitutions({ activeOnly: false }),
    fetchMonthlyContracts(),
  ]);
  const targets = listBulkPrefillTargets(institutions, contracts, yearMonth);
  const applied = [];
  for (const t of targets) {
    const saved = await saveMonthlyContract(buildMonthlyContractPayload({
      institutionId: t.institution.id,
      yearMonth,
      amount: t.amount,
      studentCount: t.studentCount,
    }));
    applied.push({ institution: t.institution, contract: saved });
  }
  const monthlyFixedCount = institutions.filter(isMonthlyFixedBilling).length;
  return {
    applied,
    targetCount: targets.length,
    monthlyFixedCount,
    alreadyFilled: monthlyFixedCount - targets.length,
  };
}

export async function fetchSessionRates(institutionId) {
  let q = scheduleSupabase
    .from("institution_session_rates")
    .select("*")
    .order("session_type")
    .order("effective_from", { ascending: false });
  if (institutionId) q = q.eq("institution_id", institutionId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertSessionRate(payload) {
  const { data, error } = await scheduleSupabase
    .from("institution_session_rates")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMonthlySessionCounts(institutionId, yearMonth) {
  let q = scheduleSupabase
    .from("institution_monthly_session_counts")
    .select("*")
    .order("session_type");
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (yearMonth) q = q.eq("year_month", yearMonthFirstDay(yearMonth));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveMonthlySessionCount(payload) {
  const ym = yearMonthFirstDay(payload.year_month?.slice?.(0, 7) || payload.year_month);
  const { data, error } = await scheduleSupabase
    .from("institution_monthly_session_counts")
    .upsert(
      { ...payload, year_month: ym, updated_at: new Date().toISOString() },
      { onConflict: "institution_id,year_month,session_type" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMonthlySessionCount(id) {
  const { error } = await scheduleSupabase
    .from("institution_monthly_session_counts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function loadBulkRevenueData(yearMonth) {
  const prevYm = previousYearMonth(yearMonth);
  const [institutions, contracts, sessionCounts, prevSessionCounts, sessionRates, teachers] = await Promise.all([
    fetchInstitutions({ activeOnly: false }),
    fetchMonthlyContracts(),
    fetchMonthlySessionCounts(null, yearMonth),
    fetchMonthlySessionCounts(null, prevYm),
    fetchSessionRates(),
    fetchTeachers(),
  ]);
  const managerMap = {};
  teachers.forEach(t => { managerMap[t.id] = t; });
  const drafts = buildBulkRevenueDrafts({
    institutions,
    contracts,
    sessionCounts,
    prevSessionCounts,
    sessionRates,
    yearMonth,
  });
  return {
    institutions,
    contracts,
    sessionCounts,
    prevSessionCounts,
    sessionRates,
    managerMap,
    drafts,
  };
}

export async function bulkSaveMonthlyRevenue({ yearMonth, institutions, drafts }) {
  let contractCount = 0;
  let sessionCount = 0;
  for (const inst of institutions) {
    const draft = drafts[inst.id];
    if (!draft || draft.mode === "partner") continue;
    if (draft.mode === "contract") {
      const amount = String(draft.amount ?? "").replace(/,/g, "");
      if (!amount) continue;
      await saveMonthlyContract(buildMonthlyContractPayload({
        institutionId: inst.id,
        yearMonth,
        amount,
        studentCount: "",
        existingId: draft.existingId,
      }));
      contractCount += 1;
      continue;
    }
    if (draft.mode === "per_session") {
      for (const type of draft.sessionTypes || []) {
        const count = Number(draft.sessions?.[type]) || 0;
        await saveMonthlySessionCount({
          id: draft.existingIds?.[type] ?? undefined,
          institution_id: inst.id,
          year_month: yearMonthFirstDay(yearMonth),
          session_type: type,
          session_count: count,
          note: null,
        });
        sessionCount += 1;
      }
      continue;
    }
    if (draft.mode === "per_capita") {
      const count = Number(draft.headcount) || 0;
      await saveMonthlySessionCount({
        id: draft.existingId ?? undefined,
        institution_id: inst.id,
        year_month: yearMonthFirstDay(yearMonth),
        session_type: "인당",
        session_count: count,
        note: null,
      });
      sessionCount += 1;
    }
  }
  return { contractCount, sessionCount };
}

export async function fetchPayRates(teacherId) {
  let q = scheduleSupabase
    .from("teacher_pay_rates")
    .select("*")
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** 오늘 기준 현재 유효 단가 (current_teacher_pay_rates 뷰) */
export async function fetchCurrentPayRates(teacherId) {
  let q = scheduleSupabase.from("current_teacher_pay_rates").select("*");
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** 특정 날짜 기준 유효 단가 (RPC) */
export async function fetchEffectiveRatesAsOf(asOfDate) {
  const { data, error } = await scheduleSupabase.rpc("get_teacher_pay_rates_as_of", {
    p_as_of: asOfDate,
  });
  if (error) throw error;
  return data || [];
}

export async function insertPayRate(payload) {
  const { data, error } = await scheduleSupabase
    .from("teacher_pay_rates")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPayrollEntries({ teacherId, institutionId, yearMonth } = {}) {
  const start = yearMonth ? yearMonthFirstDay(yearMonth) : null;
  const end = yearMonth ? yearMonthLastDay(yearMonth) : null;

  if (teacherId && start && end) {
    const baseSelect = "*, institutions(id, name)";
    const [byClassRes, byMakeupRes] = await Promise.all([
      scheduleSupabase
        .from("payroll_entries")
        .select(baseSelect)
        .or(`teacher_id.eq.${teacherId},substitute_teacher_id.eq.${teacherId}`)
        .gte("class_date", start)
        .lte("class_date", end)
        .order("class_date", { ascending: false }),
      scheduleSupabase
        .from("payroll_entries")
        .select(baseSelect)
        .eq("teacher_id", teacherId)
        .eq("is_makeup", true)
        .gte("makeup_date", start)
        .lte("makeup_date", end)
        .order("class_date", { ascending: false }),
    ]);
    if (byClassRes.error) {
      // substitute_teacher_id 컬럼 미적용 DB 폴백
      if (/substitute_teacher_id|is_makeup|makeup_date/i.test(byClassRes.error.message || "")) {
        let q = scheduleSupabase
          .from("payroll_entries")
          .select(baseSelect)
          .eq("teacher_id", teacherId)
          .gte("class_date", start)
          .lte("class_date", end)
          .order("class_date", { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      }
      throw byClassRes.error;
    }
    if (byMakeupRes.error && !/is_makeup|makeup_date/i.test(byMakeupRes.error.message || "")) {
      throw byMakeupRes.error;
    }
    const byId = new Map();
    for (const row of byClassRes.data || []) byId.set(row.id, row);
    for (const row of byMakeupRes.data || []) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) => String(b.class_date).localeCompare(String(a.class_date)));
  }

  let q = scheduleSupabase
    .from("payroll_entries")
    .select("*, institutions(id, name)")
    .order("class_date", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (start && end) {
    q = q.gte("class_date", start).lte("class_date", end);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function savePayrollEntry(payload) {
  const {
    id,
    teacher_id,
    institution_id,
    class_date,
    pay_type,
    minutes,
    note,
    entry_status,
    schedule_slot_id,
    home_visit_pattern_id,
    substitute_teacher_id,
    is_makeup,
    makeup_date,
    makeup_start_time,
    makeup_end_time,
  } = payload;
  const row = {
    teacher_id,
    institution_id: institution_id ?? null,
    class_date,
    pay_type,
    minutes: Number(minutes),
    note: note ?? null,
    entry_status: entry_status ?? null,
    schedule_slot_id: schedule_slot_id ?? null,
    home_visit_pattern_id: home_visit_pattern_id ?? null,
    updated_at: new Date().toISOString(),
  };
  if ("substitute_teacher_id" in payload) {
    row.substitute_teacher_id = substitute_teacher_id || null;
  }
  if ("is_makeup" in payload) {
    row.is_makeup = Boolean(is_makeup);
  }
  if ("makeup_date" in payload) {
    row.makeup_date = makeup_date || null;
  }
  if ("makeup_start_time" in payload) {
    row.makeup_start_time = makeup_start_time || null;
  }
  if ("makeup_end_time" in payload) {
    row.makeup_end_time = makeup_end_time || null;
  }
  if (id) {
    const { data, error } = await scheduleSupabase
      .from("payroll_entries")
      .update(row)
      .eq("id", id)
      .select("*, institutions(id, name)")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("payroll_entries")
    .insert(row)
    .select("*, institutions(id, name)")
    .single();
  if (error) throw error;
  return data;
}

/** schedule_slot_id 또는 home_visit_pattern_id + class_date 기준 upsert */
export async function upsertPayrollSlot(payload) {
  const { teacher_id, class_date, schedule_slot_id, home_visit_pattern_id } = payload;
  if (schedule_slot_id) {
    const { data: existing, error: findErr } = await scheduleSupabase
      .from("payroll_entries")
      .select("id")
      .eq("teacher_id", teacher_id)
      .eq("class_date", class_date)
      .eq("schedule_slot_id", schedule_slot_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) {
      return savePayrollEntry({ ...payload, id: existing.id });
    }
  }
  if (home_visit_pattern_id) {
    const { data: existing, error: findErr } = await scheduleSupabase
      .from("payroll_entries")
      .select("id")
      .eq("teacher_id", teacher_id)
      .eq("class_date", class_date)
      .eq("home_visit_pattern_id", home_visit_pattern_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) {
      return savePayrollEntry({ ...payload, id: existing.id });
    }
  }
  return savePayrollEntry(payload);
}

/** 여러 슬롯 일괄 upsert (순차 처리) */
export async function bulkUpsertPayrollSlots(items) {
  const results = [];
  for (const payload of items) {
    results.push(await upsertPayrollSlot(payload));
  }
  return results;
}

async function enrichScheduleChangeNotifications(rows) {
  if (!rows?.length) return [];
  const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
  const instIds = [...new Set(rows.map(r => r.institution_id).filter(Boolean))];
  const teachersById = new Map();
  const instById = new Map();

  if (teacherIds.length) {
    const { data, error } = await scheduleSupabase
      .from("teachers")
      .select("id, name")
      .in("id", teacherIds);
    if (error) throw error;
    (data || []).forEach(t => teachersById.set(t.id, t));
  }
  if (instIds.length) {
    const { data, error } = await scheduleSupabase
      .from("institutions")
      .select("id, name")
      .in("id", instIds);
    if (error) throw error;
    (data || []).forEach(i => instById.set(i.id, i));
  }

  return rows.map(row => ({
    ...row,
    teachers: teachersById.get(row.teacher_id) || null,
    institutions: row.institution_id ? instById.get(row.institution_id) || null : null,
  }));
}

async function insertScheduleChangeNotificationRow(row) {
  const { error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .insert(row);
  if (error) throw error;
}

export async function createScheduleChangeNotification(row) {
  const core = {
    teacher_id: row.teacher_id,
    institution_id: row.institution_id ?? null,
    class_date: row.class_date,
    schedule_slot_id: row.schedule_slot_id ?? null,
    change_type: row.change_type,
    original_schedule: row.original_schedule,
    actual_handling: row.actual_handling,
  };
  const extended = { ...core };
  if (row.pay_type) extended.pay_type = row.pay_type;
  if (row.home_visit_pattern_id) extended.home_visit_pattern_id = row.home_visit_pattern_id;
  if (row.change_reason) extended.change_reason = row.change_reason;
  if (row.is_read === true) {
    extended.is_read = true;
    extended.read_at = row.read_at || new Date().toISOString();
  }

  try {
    await insertScheduleChangeNotificationRow(extended);
    return extended;
  } catch (error) {
    const msg = error.message || "";
    if (/change_reason/.test(msg) && row.change_reason) {
      const withoutReason = { ...extended };
      delete withoutReason.change_reason;
      try {
        await insertScheduleChangeNotificationRow(withoutReason);
        return withoutReason;
      } catch (_) { /* 다른 폴백 시도 */ }
    }
    // patch 13 미적용 DB: pay_type / home_visit_pattern_id 컬럼 없을 때 핵심 필드만 재시도
    if (/pay_type|home_visit_pattern_id/.test(msg)) {
      await insertScheduleChangeNotificationRow(core);
      return core;
    }

    // patch 15 미적용 DB: extra_added change_type 불가 시 custom으로 폴백
    if (row.change_type === "extra_added") {
      const fallback = {
        ...core,
        change_type: "custom",
        original_schedule: row.original_schedule,
        actual_handling: `스케줄 외 추가: ${row.actual_handling}`,
      };
      await insertScheduleChangeNotificationRow(fallback);
      return fallback;
    }

    throw error;
  }
}

export async function fetchScheduleChangeNotifications({
  yearMonth,
  classDateFrom,
  classDateTo,
  limit,
} = {}) {
  let q = scheduleSupabase
    .from("schedule_change_notifications")
    .select("*")
    .order("class_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (yearMonth) {
    q = q
      .gte("class_date", yearMonthFirstDay(yearMonth))
      .lte("class_date", yearMonthLastDay(yearMonth));
  } else {
    if (classDateFrom) q = q.gte("class_date", classDateFrom);
    if (classDateTo) q = q.lte("class_date", classDateTo);
  }
  if (limit) q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return enrichScheduleChangeNotifications(data || []);
}

export async function countScheduleChangeNotifications({ yearMonth } = {}) {
  let q = scheduleSupabase
    .from("schedule_change_notifications")
    .select("id", { count: "exact", head: true });
  if (yearMonth) {
    q = q
      .gte("class_date", yearMonthFirstDay(yearMonth))
      .lte("class_date", yearMonthLastDay(yearMonth));
  }
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function countUnreadScheduleChangeNotifications() {
  const { count, error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw error;
  return count || 0;
}

export async function markScheduleChangeNotificationRead(id) {
  const { data, error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllScheduleChangeNotificationsRead({ yearMonth } = {}) {
  let q = scheduleSupabase
    .from("schedule_change_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
  if (yearMonth) {
    q = q
      .gte("class_date", yearMonthFirstDay(yearMonth))
      .lte("class_date", yearMonthLastDay(yearMonth));
  }
  const { error } = await q;
  if (error) throw error;
}

export async function markScheduleChangeNotificationsReadByIds(ids) {
  if (!ids?.length) return;
  const { error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function fetchAllWeeklySchedules() {
  const { data, error } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .select("*, institutions(id, name)");
  if (error) throw error;
  return data || [];
}

export async function deletePayrollEntry(id) {
  const { error } = await scheduleSupabase
    .from("payroll_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchTeacherNotes({ teacherId, fromDate, toDate } = {}) {
  const buildQuery = (select) => {
    let q = scheduleSupabase.from("teacher_notes").select(select);
    if (teacherId) q = q.eq("teacher_id", teacherId);
    if (fromDate) q = q.gte("note_date", fromDate);
    if (toDate) q = q.lte("note_date", toDate);
    return q.order("note_date", { ascending: true });
  };

  const { data, error } = await buildQuery("*, teachers(id, name)");
  if (!error) return data || [];

  // teachers embed 실패 시 본인 메모 조회만이라도 되도록 fallback
  const { data: plain, error: plainError } = await buildQuery("*");
  if (plainError) throw plainError;
  return plain || [];
}

export async function upsertTeacherNote({ id, teacher_id, note_date, content }) {
  const row = {
    teacher_id,
    note_date: String(note_date).slice(0, 10),
    content: content.trim(),
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await scheduleSupabase
      .from("teacher_notes")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("teacher_notes")
    .upsert(row, { onConflict: "teacher_id,note_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeacherNote(id) {
  const { error } = await scheduleSupabase
    .from("teacher_notes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchAdditionalPayments({ teacherId, yearMonth } = {}) {
  let q = scheduleSupabase
    .from("additional_payments")
    .select("*")
    .order("year_month", { ascending: true });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (yearMonth) {
    q = q.eq("year_month", toYearMonthDate(yearMonth));
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

function toYearMonthDate(key) {
  if (!key) return null;
  const ym = String(key).slice(0, 7);
  return `${ym}-01`;
}

export async function insertAdditionalPayment(payload) {
  const row = {
    teacher_id: payload.teacher_id,
    year_month: toYearMonthDate(payload.year_month),
    amount: Number(payload.amount),
    reason: payload.reason.trim(),
    created_by: payload.created_by,
  };
  const { data, error } = await scheduleSupabase
    .from("additional_payments")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAdditionalPayment(id, payload) {
  const { data, error } = await scheduleSupabase
    .from("additional_payments")
    .update({
      amount: Number(payload.amount),
      reason: payload.reason.trim(),
      year_month: toYearMonthDate(payload.year_month),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdditionalPayment(id) {
  const { error } = await scheduleSupabase
    .from("additional_payments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchAdditionalPaymentRequests({ teacherId, yearMonth, status } = {}) {
  let q = scheduleSupabase
    .from("additional_payment_requests")
    .select("*, teachers(id, name)")
    .order("created_at", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (yearMonth) q = q.eq("year_month", yearMonthFirstDay(yearMonth));
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw error;
  }
  return data || [];
}

function normalizeTimeValue(value) {
  if (!value) return null;
  const t = String(value).trim();
  if (!t) return null;
  // HTML time input → HH:MM ; DB time accepts HH:MM:SS
  return t.length === 5 ? `${t}:00` : t;
}

export async function insertAdditionalPaymentRequest({
  teacher_id,
  year_month,
  amount,
  reason,
  memo,
  event_date = null,
  start_time = null,
  end_time = null,
  location = null,
}) {
  const eventDate = event_date ? String(event_date).slice(0, 10) : null;
  const ymSource = eventDate || year_month;
  const { data, error } = await scheduleSupabase
    .from("additional_payment_requests")
    .insert({
      teacher_id,
      year_month: yearMonthFirstDay(ymSource),
      event_date: eventDate,
      start_time: normalizeTimeValue(start_time),
      end_time: normalizeTimeValue(end_time),
      location: location?.trim() || null,
      amount: Number(amount),
      reason: reason.trim(),
      memo: memo?.trim() || null,
      status: "pending",
    })
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) {
      throw new Error("추가 급여 신청 기능이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
    }
    throw error;
  }
  return data;
}

export async function approveAdditionalPaymentRequest(requestId, { reviewed_by, created_by }) {
  const { data: req, error: fetchErr } = await scheduleSupabase
    .from("additional_payment_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchErr || !req) throw fetchErr || new Error("신청을 찾을 수 없습니다.");
  if (req.status !== "pending") throw new Error("이미 처리된 신청입니다.");

  const payment = await insertAdditionalPayment({
    teacher_id: req.teacher_id,
    year_month: req.year_month,
    amount: req.amount,
    reason: req.reason,
    created_by: created_by || reviewed_by,
  });

  const now = new Date().toISOString();
  const { data, error } = await scheduleSupabase
    .from("additional_payment_requests")
    .update({
      status: "approved",
      reviewed_by,
      reviewed_at: now,
      additional_payment_id: payment.id,
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function rejectAdditionalPaymentRequest(requestId, { reviewed_by, rejection_reason }) {
  const reason = (rejection_reason || "").trim();
  if (!reason) throw new Error("거절 사유를 입력하세요.");
  const now = new Date().toISOString();
  const { data, error } = await scheduleSupabase
    .from("additional_payment_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by,
      reviewed_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSettlements(yearMonth) {
  const ym = yearMonthFirstDay(yearMonth);
  const { data, error } = await scheduleSupabase
    .from("monthly_settlements")
    .select("*, institutions(*)")
    .eq("year_month", ym);
  if (error) throw error;
  return data || [];
}

export async function fetchFinalizedInstitutionIds(yearMonth) {
  const rows = await fetchSettlements(yearMonth);
  return new Set(rows.filter(r => r.is_finalized).map(r => r.institution_id));
}

export async function computeAndSaveSettlement(institution, yearMonth, payrollEntries, rates, teachers = []) {
  const ym = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);
  const [contracts, sessionCounts, sessionRates, temporaryEngagements, allWeekly, exceptionsRes] = await Promise.all([
    fetchMonthlyContracts(institution.id),
    fetchMonthlySessionCounts(institution.id, yearMonth),
    fetchSessionRates(institution.id),
    fetchTemporaryEngagementsForMonth(yearMonth),
    fetchAllWeeklySchedules(),
    scheduleSupabase
      .from("institution_schedule_exceptions")
      .select("*")
      .gte("exception_date", ym)
      .lte("exception_date", monthEnd),
  ]);
  const contract = contracts.find(c => c.year_month === ym);
  const scheduleExceptions = exceptionsRes.data || [];

  const revenue = resolveInstitutionRevenue({
    institution,
    contract,
    sessionCounts,
    sessionRates,
    yearMonth,
  });

  const manualInstructorCost = Number(contract?.external_instructor_cost) || 0;
  const additionalPayments = await fetchAdditionalPayments({ yearMonth });
  const costDetail = computeInstitutionInstructorCost({
    institution,
    entries: payrollEntries,
    rates,
    teachers,
    yearMonth,
    additionalPayments,
    temporaryEngagements,
    weeklySlots: allWeekly,
    scheduleExceptions,
  });
  const settlementType = resolveSettlementContractType(institution);
  const settlementSessionCost = settlementType === "manager_fixed_payout"
    ? costDetail.supplementaryPay
    : costDetail.total;
  let instructorCost = settlementType === "manager_personal"
    ? 0
    : settlementSessionCost;
  if (settlementType === "manager_threshold_split") {
    instructorCost = manualInstructorCost;
  }

  const calc = applyManagerShareAdjustments(
    institution,
    computeSettlement({
      contractType: settlementType,
      revenue,
      instructorCost,
      fixedPayoutAmount: institution.fixed_payout_amount,
    }),
  );

  let displayInstructorCost = settlementType === "manager_personal"
    ? 0
    : costDetail.total;
  if (settlementType === "manager_threshold_split") {
    displayInstructorCost = manualInstructorCost;
  }

  const payload = {
    institution_id: institution.id,
    year_month: ym,
    ...calc,
    instructor_cost: displayInstructorCost,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await scheduleSupabase
    .from("monthly_settlements")
    .upsert(payload, { onConflict: "institution_id,year_month" })
    .select("*, institutions(*)")
    .single();
  if (error) throw error;
  return data;
}

export async function finalizeMonthSettlements(yearMonth) {
  const ym = yearMonthFirstDay(yearMonth);
  const { error } = await scheduleSupabase
    .from("monthly_settlements")
    .update({ is_finalized: true, finalized_at: new Date().toISOString() })
    .eq("year_month", ym);
  if (error) throw error;
}

function institutionHasRevenueInput(institution, contract, sessionCounts, sessionRates = []) {
  if (institution?.contract_type === "partner_billing") {
    return (sessionCounts || []).some(r => Number(r.session_count) > 0)
      || contract != null;
  }
  if (isPerCapitaBilling(institution, sessionRates, sessionCounts) || institution?.billing_type === "per_session") {
    return (sessionCounts || []).length > 0;
  }
  return contract != null;
}

async function buildInstitutionDashboardRow(
  institution,
  yearMonth,
  contract,
  settlement,
  entries,
  rates,
  teachers = [],
  temporaryEngagements = [],
  weeklySlots = [],
  scheduleExceptions = [],
  additionalPayments = [],
) {
  const [sessionCounts, sessionRates] = await Promise.all([
    fetchMonthlySessionCounts(institution.id, yearMonth),
    fetchSessionRates(institution.id),
  ]);

  const revenue = resolveInstitutionRevenue({
    institution,
    contract,
    sessionCounts,
    sessionRates,
    yearMonth,
  });
  const hasRevenue = institutionHasRevenueInput(institution, contract, sessionCounts, sessionRates);
  const manualInstructorCost = Number(contract?.external_instructor_cost) || 0;

  const costDetail = computeInstitutionInstructorCost({
    institution,
    entries,
    rates,
    teachers,
    yearMonth,
    additionalPayments,
    temporaryEngagements,
    weeklySlots,
    scheduleExceptions,
  });
  const settlementType = resolveSettlementContractType(institution);
  const settlementSessionCost = settlementType === "manager_fixed_payout"
    ? costDetail.supplementaryPay
    : costDetail.total;
  let instructorCostForCalc = settlementType === "manager_personal"
    ? 0
    : settlementSessionCost;
  if (settlementType === "manager_threshold_split") {
    instructorCostForCalc = manualInstructorCost;
  }

  const calc = applyManagerShareAdjustments(
    institution,
    computeSettlement({
      contractType: settlementType,
      revenue,
      instructorCost: instructorCostForCalc,
      fixedPayoutAmount: institution.fixed_payout_amount,
    }),
  );

  let displayInstructorCost = settlementType === "manager_personal"
    ? 0
    : costDetail.total;
  if (settlementType === "manager_threshold_split") {
    displayInstructorCost = manualInstructorCost;
  }

  return {
    institution,
    contract,
    settlement,
    isFinalized: settlement?.is_finalized ?? false,
    hasRevenue,
    revenue: calc.revenue,
    vat: calc.vat,
    revenue_after_vat: calc.revenue_after_vat,
    income_tax: calc.income_tax,
    instructor_cost: displayInstructorCost,
    instructorCostBreakdown: costDetail.breakdown,
    supplementaryInstructorPay: costDetail.supplementaryPay,
    net_profit: calc.net_profit,
    manager_share: calc.manager_share,
    gts_share: calc.gts_share,
    partner_invoice_amount: calc.partner_invoice_amount,
    fixed_payout: calc.fixed_payout,
    manager_payout_net: calc.manager_payout_net,
    threshold_split_excess: calc.threshold_split_excess,
    threshold_split_remainder: calc.threshold_split_remainder,
    external_instructor_cost: manualInstructorCost,
  };
}

export async function loadPayrollDashboard(yearMonth) {
  const ym = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);
  const [y, m] = yearMonth.split("-").map(Number);

  const [teachers, entries, rates, institutions, allWeekly, exceptionsRes, teacherNotes, additionalPayments, substituteLessons, oneoffLessons] = await Promise.all([
    fetchTeachers(),
    fetchPayrollEntries({ yearMonth }),
    fetchPayRates(),
    fetchInstitutions({ activeOnly: false }),
    fetchAllWeeklySchedules(),
    scheduleSupabase
      .from("institution_schedule_exceptions")
      .select("*")
      .gte("exception_date", ym)
      .lte("exception_date", monthEnd),
    fetchTeacherNotes({ fromDate: ym, toDate: monthEnd }),
    fetchAdditionalPayments({ yearMonth }),
    fetchSubstituteLessons({ yearMonth }),
    fetchOneoffLessons({ yearMonth }),
  ]);

  const exceptions = exceptionsRes.data || [];

  const weeklyByTeacher = {};
  for (const slot of allWeekly) {
    const tid = slot.teacher_id;
    if (!tid) continue;
    if (!weeklyByTeacher[tid]) weeklyByTeacher[tid] = [];
    weeklyByTeacher[tid].push(slot);
  }

  const teacherRows = teachers
    .filter(t => t.role === "teacher")
    .map(t => {
      const mine = entries.filter(e =>
        e.teacher_id === t.id || e.substitute_teacher_id === t.id,
      );
      const byType = groupPayrollByTypeConfirmed(mine, t.id);
      const lessonPay = estimateTeacherPayByEntry(mine, rates, {}, t.id);
      const teacherOneoff = oneoffLessons.filter(l => l.teacher_id === t.id);
      const oneoffPayAdj = sumOneoffCustomPayAdjustments(mine, teacherOneoff, rates);
      const adjustedLessonPay = lessonPay + oneoffPayAdj;
      const teacherAdditional = additionalPayments.filter(p => p.teacher_id === t.id);
      const additionalTotal = sumMergedAdditionalPayments(teacherAdditional);
      const estimatedPay = resolveTeacherMonthlyGross(
        t.id, yearMonth, adjustedLessonPay, teacherAdditional, t.name,
      );
      const lastEntry = mine[0];
      const teacherInstIds = new Set(
        (weeklyByTeacher[t.id] || []).map(s => s.institution_id).filter(Boolean),
      );
      const teacherExceptions = exceptions.filter(ex => teacherInstIds.has(ex.institution_id));
      const scheduleByDate = expandMonthSchedule(
        weeklyByTeacher[t.id] || [],
        y,
        m - 1,
        teacherExceptions,
      );
      const unconfirmedDays = countUnconfirmedDays(scheduleByDate, mine);
      const skippedCount = countSkippedEntries(mine);
      const hasScheduled = Object.values(scheduleByDate).some(arr => arr.length > 0);
      const stale = hasScheduled && unconfirmedDays > 0;
      const inputMissing = stale || (hasScheduled && !lastEntry?.class_date);

      return {
        teacher: t,
        byType,
        totalMinutes: Object.values(byType).reduce((s, n) => s + n, 0),
        lessonPay: adjustedLessonPay,
        additionalPayments: teacherAdditional,
        additionalTotal,
        estimatedPay,
        lastEntryDate: lastEntry?.class_date ?? null,
        unconfirmedDays,
        skippedCount,
        hasScheduled,
        stale,
        inputMissing,
      };
    });

  const contracts = await scheduleSupabase
    .from("institution_monthly_contracts")
    .select("*")
    .eq("year_month", yearMonthFirstDay(yearMonth));
  const contractMap = {};
  (contracts.data || []).forEach(c => { contractMap[c.institution_id] = c; });

  const settlements = await fetchSettlements(yearMonth);
  const settlementMap = {};
  settlements.forEach(s => { settlementMap[s.institution_id] = s; });

  const temporaryEngagements = await fetchTemporaryEngagementsForMonth(yearMonth);

  const institutionRows = await Promise.all(
    institutions.map(inst =>
      buildInstitutionDashboardRow(
        inst,
        yearMonth,
        contractMap[inst.id] ?? null,
        settlementMap[inst.id] ?? null,
        entries,
        rates,
        teachers,
        temporaryEngagements,
        allWeekly,
        exceptions,
        additionalPayments,
      ),
    ),
  );

  const managerMap = {};
  teachers.forEach(t => { managerMap[t.id] = t; });

  const tempTeacherRows = buildTempTeacherPayrollRows({
    engagements: temporaryEngagements,
    entries,
    rates,
    institutions,
    teachers,
    yearMonth,
    weeklySlots: allWeekly,
    scheduleExceptions: exceptions,
  });

  const tempById = new Map(tempTeacherRows.map(r => [r.tempTeacher.id, r]));
  const instMap = Object.fromEntries(institutions.map(i => [i.id, i]));
  for (const [tempId, lessons] of groupSubstituteLessonsByTempTeacher(substituteLessons, yearMonth)) {
    const extraPay = lessons.reduce((s, l) => s + (Number(l.substitute_pay_amount) || 0), 0);
    if (extraPay <= 0) continue;
    if (tempById.has(tempId)) {
      const row = tempById.get(tempId);
      row.estimatedPay = Math.round((Number(row.estimatedPay) || 0) + extraPay);
      row.substituteLessonPay = (Number(row.substituteLessonPay) || 0) + extraPay;
      row.substituteLessonCount = (Number(row.substituteLessonCount) || 0) + lessons.length;
    } else {
      const eng = lessons[0].substitute_temp_teacher;
      if (!eng) continue;
      tempTeacherRows.push({
        isTemporary: true,
        teacher: { id: `temp:${eng.id}`, name: eng.name },
        tempTeacher: eng,
        institution: instMap[eng.institution_id],
        institutionName: instMap[eng.institution_id]?.name ?? "—",
        sessionCount: lessons.length,
        workHours: 0,
        workDays: 0,
        totalMinutes: 0,
        estimatedPay: extraPay,
        substituteLessonPay: extraPay,
        substituteLessonCount: lessons.length,
        payMode: eng.pay_mode,
        rateAmount: Number(eng.rate_amount) || 0,
        payType: eng.pay_type || "정규",
        byType: { 정규: 0, 방과후: 0, 가정방문: 0, 센터: 0, 센터보조: 0 },
        paySummaryLabel: `대체수업 ${lessons.length}회`,
        isSubstitute: false,
        substituteTeacherName: null,
        substitutePeriod: null,
        engagementPeriod: "—",
        settlementLabel: `대체수업 ${lessons.length}회`,
        inputMissing: false,
        unconfirmedDays: 0,
        additionalTotal: 0,
        additionalPayments: [],
      });
    }
  }
  tempTeacherRows.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "ko"));

  return {
    teacherRows,
    tempTeacherRows,
    institutionRows,
    entries,
    rates,
    institutions,
    managerMap,
    teacherNotes,
    additionalPayments,
    teachers,
  };
}
