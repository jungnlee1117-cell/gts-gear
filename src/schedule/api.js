import { resolveTeacherMonthlyGross } from "./additionalPayments.js";
import { createClient } from "@supabase/supabase-js";
import { yearMonthFirstDay, yearMonthLastDay } from "./constants.js";
import { buildMonthlyContractPayload, buildBulkRevenueDrafts, isMonthlyFixedBilling, listBulkPrefillTargets, previousYearMonth } from "./monthlyBilling.js";
import {
  computeSettlement,
  estimateTeacherPayByEntry,
  resolveInstitutionRevenue,
} from "./settlement.js";
import {
  countSkippedEntries,
  countUnconfirmedDays,
  expandMonthSchedule,
  groupPayrollByTypeConfirmed,
} from "./payrollCalendar.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const scheduleSupabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export async function fetchTeachers() {
  const { data, error } = await scheduleSupabase
    .from("teachers")
    .select("id, name, role, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data || [];
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

export async function fetchAssignments(institutionId, { activeOnly = true } = {}) {
  let q = scheduleSupabase
    .from("institution_teacher_assignments")
    .select("*, teachers(id, name)")
    .order("created_at", { ascending: false });
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveAssignment({ institution_id, teacher_id, pay_types }) {
  const { data, error } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .upsert(
      { institution_id, teacher_id, pay_types, is_active: true },
      { onConflict: "institution_id,teacher_id" },
    )
    .select("*, teachers(id, name)")
    .single();
  if (error) throw error;
  return data;
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
  return data || [];
}

export async function saveWeeklySlot(payload) {
  if (payload.id) {
    const { data, error } = await scheduleSupabase
      .from("institution_weekly_schedule")
      .update(payload)
      .eq("id", payload.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .insert(payload)
    .select()
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
  let q = scheduleSupabase
    .from("payroll_entries")
    .select("*, institutions(id, name)")
    .order("class_date", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (institutionId) q = q.eq("institution_id", institutionId);
  if (yearMonth) {
    const start = yearMonthFirstDay(yearMonth);
    const end = yearMonthLastDay(yearMonth);
    q = q.gte("class_date", start).lte("class_date", end);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function savePayrollEntry(payload) {
  const row = { ...payload, updated_at: new Date().toISOString() };
  if (payload.id) {
    const { data, error } = await scheduleSupabase
      .from("payroll_entries")
      .update(row)
      .eq("id", payload.id)
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

  let { data, error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .insert(extended)
    .select()
    .single();

  // patch 13 미적용 DB: pay_type / home_visit_pattern_id 컬럼 없을 때 핵심 필드만 재시도
  if (error && /pay_type|home_visit_pattern_id/.test(error.message || "")) {
    const retry = await scheduleSupabase
      .from("schedule_change_notifications")
      .insert(core)
      .select()
      .single();
    if (retry.error) throw retry.error;
    return retry.data;
  }

  // patch 15 미적용 DB: extra_added change_type 불가 시 custom으로 폴백
  if (error && row.change_type === "extra_added") {
    const fallback = await scheduleSupabase
      .from("schedule_change_notifications")
      .insert({
        ...core,
        change_type: "custom",
        original_schedule: row.original_schedule,
        actual_handling: `스케줄 외 추가: ${row.actual_handling}`,
      })
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }

  if (error) throw error;
  return data;
}

export async function fetchScheduleChangeNotifications({
  yearMonth,
  classDateFrom,
  classDateTo,
  limit,
} = {}) {
  let q = scheduleSupabase
    .from("schedule_change_notifications")
    .select("*, teachers(id, name), institutions(id, name)")
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
  return data || [];
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
  let q = scheduleSupabase
    .from("teacher_notes")
    .select("*, teachers(id, name)")
    .order("note_date", { ascending: true });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (fromDate) q = q.gte("note_date", fromDate);
  if (toDate) q = q.lte("note_date", toDate);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertTeacherNote({ id, teacher_id, note_date, content }) {
  const row = {
    teacher_id,
    note_date,
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
    .order("created_at", { ascending: true });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (yearMonth) q = q.eq("year_month", yearMonthFirstDay(yearMonth));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertAdditionalPayment(payload) {
  const row = {
    teacher_id: payload.teacher_id,
    year_month: yearMonthFirstDay(payload.year_month),
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

export async function deleteAdditionalPayment(id) {
  const { error } = await scheduleSupabase
    .from("additional_payments")
    .delete()
    .eq("id", id);
  if (error) throw error;
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

export async function computeAndSaveSettlement(institution, yearMonth, payrollEntries, rates) {
  const ym = yearMonthFirstDay(yearMonth);
  const [contracts, sessionCounts, sessionRates] = await Promise.all([
    fetchMonthlyContracts(institution.id),
    fetchMonthlySessionCounts(institution.id, yearMonth),
    fetchSessionRates(institution.id),
  ]);
  const contract = contracts.find(c => c.year_month === ym);

  const revenue = resolveInstitutionRevenue({
    institution,
    contract,
    sessionCounts,
    sessionRates,
    yearMonth,
  });

  const instEntries = payrollEntries.filter(e => e.institution_id === institution.id);
  const instructorCost = institution.contract_type === "manager_personal"
    ? 0
    : estimateTeacherPayByEntry(instEntries, rates);

  const calc = computeSettlement({
    contractType: institution.contract_type,
    revenue,
    instructorCost,
    fixedPayoutAmount: institution.fixed_payout_amount,
  });

  const payload = {
    institution_id: institution.id,
    year_month: ym,
    ...calc,
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

function institutionHasRevenueInput(institution, contract, sessionCounts) {
  if (institution?.contract_type === "partner_billing") {
    return (sessionCounts || []).some(r => Number(r.session_count) > 0)
      || Boolean(contract?.contract_amount);
  }
  if (institution?.billing_type === "per_session") {
    return (sessionCounts || []).some(r => Number(r.session_count) > 0);
  }
  return Boolean(contract?.contract_amount);
}

async function buildInstitutionDashboardRow(
  institution,
  yearMonth,
  contract,
  settlement,
  entries,
  rates,
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
  const hasRevenue = institutionHasRevenueInput(institution, contract, sessionCounts);

  const instEntries = entries.filter(e => e.institution_id === institution.id);
  const instructorCost = institution.contract_type === "manager_personal"
    ? 0
    : estimateTeacherPayByEntry(instEntries, rates);

  const calc = computeSettlement({
    contractType: institution.contract_type,
    revenue,
    instructorCost,
    fixedPayoutAmount: institution.fixed_payout_amount,
  });

  return {
    institution,
    contract,
    settlement,
    isFinalized: settlement?.is_finalized ?? false,
    hasRevenue,
    revenue: calc.revenue,
    vat: calc.vat,
    income_tax: calc.income_tax,
    instructor_cost: calc.instructor_cost,
    net_profit: calc.net_profit,
    manager_share: calc.manager_share,
    gts_share: calc.gts_share,
    partner_invoice_amount: calc.partner_invoice_amount,
    fixed_payout: calc.fixed_payout,
  };
}

export async function loadPayrollDashboard(yearMonth) {
  const ym = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);
  const [y, m] = yearMonth.split("-").map(Number);

  const [teachers, entries, rates, institutions, allWeekly, exceptionsRes, teacherNotes, additionalPayments] = await Promise.all([
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
      const mine = entries.filter(e => e.teacher_id === t.id);
      const byType = groupPayrollByTypeConfirmed(mine);
      const lessonPay = estimateTeacherPayByEntry(
        mine.filter(e => e.minutes > 0),
        rates,
      );
      const teacherAdditional = additionalPayments.filter(p => p.teacher_id === t.id);
      const additionalTotal = teacherAdditional.reduce((s, p) => s + Number(p.amount || 0), 0);
      const estimatedPay = resolveTeacherMonthlyGross(t.id, yearMonth, lessonPay, teacherAdditional);
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
        lessonPay,
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

  const institutionRows = await Promise.all(
    institutions.map(inst =>
      buildInstitutionDashboardRow(
        inst,
        yearMonth,
        contractMap[inst.id] ?? null,
        settlementMap[inst.id] ?? null,
        entries,
        rates,
      ),
    ),
  );

  const managerMap = {};
  teachers.forEach(t => { managerMap[t.id] = t; });

  return { teacherRows, institutionRows, entries, rates, institutions, managerMap, teacherNotes, additionalPayments, teachers };
}
