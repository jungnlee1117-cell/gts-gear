import { createClient } from "@supabase/supabase-js";
import { sendPushEvent } from "./pushNotifications.js";
import { fmtLocalDate } from "./schedule/constants.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/** YYYY-MM-DD today local */
export function todayLocalDateStr() {
  return fmtLocalDate(new Date());
}

export function isResignedTeacher(teacher) {
  return Boolean(teacher?.resigned_at);
}

/**
 * 로그인·세션 접근 차단 여부.
 * - 퇴직일(resigned_at) 당일까지 허용, 다음날부터 차단
 * - 퇴직 없이 active=false 이면 비활성 차단
 */
export function getTeacherAccessBlock(teacher) {
  if (!teacher) {
    return { blocked: true, message: "계정 정보를 확인할 수 없습니다." };
  }
  if (teacher.resigned_at) {
    const resignDay = String(teacher.resigned_at).slice(0, 10);
    const today = todayLocalDateStr();
    if (today > resignDay) {
      return { blocked: true, message: "퇴직 처리된 계정입니다" };
    }
    return { blocked: false };
  }
  if (teacher.active === false) {
    return {
      blocked: true,
      message: "비활성화된 계정입니다. 관리자에게 문의하세요.",
    };
  }
  return { blocked: false };
}

export function yearMonthFromDate(dateStr) {
  return String(dateStr || "").slice(0, 7) + "-01";
}

/** 퇴직일 이후에도 유효한 주간 슬롯을 기관별로 묶음 */
export async function fetchUpcomingClassesByInstitution(teacherId, resignDate) {
  const resignDay = String(resignDate).slice(0, 10);
  const { data, error } = await supabase
    .from("institution_weekly_schedule")
    .select("*, institutions(id, name)")
    .eq("teacher_id", teacherId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;

  const slots = (data || []).filter(slot => {
    const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
    // 퇴직일 당일 또는 그 이전에 이미 끝난 슬롯 제외
    if (to && to <= resignDay) return false;
    return true;
  });

  const byInst = new Map();
  for (const slot of slots) {
    const key = slot.institution_id || "none";
    if (!byInst.has(key)) {
      byInst.set(key, {
        institutionId: slot.institution_id || null,
        institutionName: slot.institutions?.name || "기관 미지정",
        slots: [],
      });
    }
    byInst.get(key).slots.push(slot);
  }
  return [...byInst.values()].sort((a, b) =>
    a.institutionName.localeCompare(b.institutionName, "ko"),
  );
}

export async function fetchActiveRentalsForTeacher(teacherId) {
  const { data: requests, error: reqErr } = await supabase
    .from("rental_requests")
    .select("id")
    .eq("teacher_id", teacherId);
  if (reqErr) throw reqErr;
  const reqIds = (requests || []).map(r => r.id);
  if (!reqIds.length) return [];

  const { data: items, error } = await supabase
    .from("rental_items")
    .select("*, items(id, name), rental_requests(id, teacher_id)")
    .in("request_id", reqIds)
    .in("status", ["rented", "partial_returned"]);
  if (error) throw error;
  return items || [];
}

async function forceReturnOne(ri, actor, reason) {
  const now = new Date().toISOString();
  const qty = Math.max(1, Number(ri.quantity) || 1);
  const memo = `강제 반납: ${reason}`;
  const teacherId = ri.rental_requests?.teacher_id;

  const { error: retErr } = await supabase.from("return_requests").insert({
    rental_item_id: ri.id,
    quantity: qty,
    condition: "normal",
    memo,
    teacher_id: teacherId || actor.id,
    status: "return_approved",
    approved_by: actor.id,
    approved_at: now,
  });
  if (retErr) throw retErr;

  const { error } = await supabase
    .from("rental_items")
    .update({ status: "returned" })
    .eq("id", ri.id);
  if (error) throw error;

  await supabase.from("activity_logs").insert({
    entity_type: "rental_item",
    entity_id: ri.id,
    action: memo,
    actor_id: actor.id,
    actor_name: actor.name,
    target_id: teacherId || null,
    target_name: null,
  });
}

async function copyRotationSchedule(fromTeacherId, toTeacherId, resignDate) {
  const fromYm = yearMonthFromDate(resignDate);
  const { data: rows, error } = await supabase
    .from("item_rotation_schedule")
    .select("*")
    .eq("teacher_id", fromTeacherId)
    .gte("year_month", fromYm);
  if (error) throw error;
  if (!rows?.length) return 0;

  let copied = 0;
  for (const row of rows) {
    const { error: upErr } = await supabase.from("item_rotation_schedule").upsert(
      {
        teacher_id: toTeacherId,
        year_month: row.year_month,
        assigned_letter: row.assigned_letter,
      },
      { onConflict: "teacher_id,year_month" },
    );
    if (!upErr) copied++;
  }
  return copied;
}

async function reassignWeeklySlots(slotIds, successorId, resignDate) {
  if (!slotIds.length || !successorId) return;
  const { error } = await supabase
    .from("institution_weekly_schedule")
    .update({ teacher_id: successorId })
    .in("id", slotIds);
  if (error) throw error;

  // 배정 연결 활성화
  const { data: slots } = await supabase
    .from("institution_weekly_schedule")
    .select("institution_id")
    .in("id", slotIds);
  const instIds = [...new Set((slots || []).map(s => s.institution_id).filter(Boolean))];
  for (const institution_id of instIds) {
    await supabase.from("institution_teacher_assignments").upsert(
      {
        institution_id,
        teacher_id: successorId,
        pay_types: ["정규", "방과후"],
        is_active: true,
        role: "teacher",
      },
      { onConflict: "institution_id,teacher_id" },
    );
  }
}

/** 퇴직일 이후 이미 생성된 payroll_entries 를 후임 선생님으로 이관 */
async function reassignFuturePayrollEntries({
  fromTeacherId,
  toTeacherId,
  institutionId,
  resignDate,
  slotIds,
}) {
  if (!fromTeacherId || !toTeacherId) return;
  const afterDay = String(resignDate).slice(0, 10);
  let q = supabase
    .from("payroll_entries")
    .update({ teacher_id: toTeacherId })
    .eq("teacher_id", fromTeacherId)
    .gt("class_date", afterDay);
  if (institutionId) q = q.eq("institution_id", institutionId);
  else if (slotIds?.length) q = q.in("schedule_slot_id", slotIds);
  const { error } = await q;
  if (error) console.warn("reassignFuturePayrollEntries:", error.message);
}

async function endWeeklySlots(slotIds, resignDate) {
  if (!slotIds.length) return;
  const { error } = await supabase
    .from("institution_weekly_schedule")
    .update({ effective_to: resignDate })
    .in("id", slotIds);
  if (error) {
    // effective_to 컬럼 없을 수 있음 — 슬롯 유지는 하되 teacher는 그대로(슈퍼관리자 미배정 알림)
    console.warn("endWeeklySlots:", error.message);
  }
}

async function notifySuccessor({ successorId, institutionName, resigningName }) {
  const body = `${institutionName} 수업이 배정됐습니다 (${resigningName} 선생님 후임)`;
  await sendPushEvent(supabase, "class_reassigned", {
    teacher_id: successorId,
    body,
    institution_name: institutionName,
  });
}

async function notifyAdminsUnassigned({ resigningName, institutionName, resignDate }) {
  await sendPushEvent(supabase, "class_unassigned_admin", {
    body: `[미배정] ${resigningName} 선생님 퇴직 후 ${institutionName} 수업이 미배정입니다 (퇴직일 ${resignDate})`,
    institution_name: institutionName,
  });
}

/**
 * 퇴직 처리 완료
 * @param {object} opts
 * @param {object} opts.teacher - 퇴직 대상
 * @param {string} opts.resignDate
 * @param {string} opts.reason
 * @param {Record<string, string>} opts.reassignments - institutionId -> successorTeacherId ("" = 미배정)
 * @param {Array} opts.institutionGroups - fetchUpcomingClassesByInstitution 결과
 * @param {object} opts.actor - 처리자 (슈퍼관리자)
 * @param {Array} opts.rentalItems - 강제 반납 대상
 */
export async function completeTeacherResignation({
  teacher,
  resignDate,
  reason,
  reassignments,
  institutionGroups,
  actor,
  rentalItems,
}) {
  const resignDay = String(resignDate).slice(0, 10);
  const reasonText = String(reason || "").trim() || "퇴직";

  // 1) 교구 강제 반납
  for (const ri of rentalItems || []) {
    await forceReturnOne(ri, actor, `퇴직 처리 (${teacher.name})`);
  }

  // 2) 수업 재배정 / 미배정 종료
  for (const group of institutionGroups || []) {
    const instKey = group.institutionId || "none";
    const successorId = reassignments[instKey] || reassignments[group.institutionId] || "";
    const slotIds = group.slots.map(s => s.id);

    if (successorId) {
      await reassignWeeklySlots(slotIds, successorId, resignDay);
      await copyRotationSchedule(teacher.id, successorId, resignDay);
      await reassignFuturePayrollEntries({
        fromTeacherId: teacher.id,
        toTeacherId: successorId,
        institutionId: group.institutionId,
        resignDate: resignDay,
        slotIds,
      });
      try {
        await notifySuccessor({
          successorId,
          institutionName: group.institutionName,
          resigningName: teacher.name,
        });
      } catch (e) {
        console.warn("successor push failed", e);
      }
    } else {
      await endWeeklySlots(slotIds, resignDay);
      try {
        await notifyAdminsUnassigned({
          resigningName: teacher.name,
          institutionName: group.institutionName,
          resignDate: resignDay,
        });
      } catch (e) {
        console.warn("admin unassigned push failed", e);
      }
    }
  }

  // 3) 선생님 퇴직 플래그 (데이터 삭제 금지)
  const { error } = await supabase
    .from("teachers")
    .update({
      active: false,
      resigned_at: resignDay,
      resignation_reason: reasonText,
    })
    .eq("id", teacher.id);
  if (error) throw error;

  await supabase.from("activity_logs").insert({
    entity_type: "account_status",
    entity_id: teacher.id,
    action: `퇴직 처리 (${resignDay}) · ${reasonText}`,
    actor_id: actor.id,
    actor_name: actor.name,
    target_id: teacher.id,
    target_name: teacher.name,
  });

  return {
    active: false,
    resigned_at: resignDay,
    resignation_reason: reasonText,
  };
}

export async function updateResignationInfo(teacherId, { resigned_at, resignation_reason }) {
  const payload = {};
  if (resigned_at !== undefined) payload.resigned_at = resigned_at || null;
  if (resignation_reason !== undefined) {
    payload.resignation_reason = resignation_reason?.trim() || null;
  }
  const { data, error } = await supabase
    .from("teachers")
    .update(payload)
    .eq("id", teacherId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function reactivateTeacher(teacherId) {
  const { data, error } = await supabase
    .from("teachers")
    .update({
      active: true,
      resigned_at: null,
      resignation_reason: null,
    })
    .eq("id", teacherId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
