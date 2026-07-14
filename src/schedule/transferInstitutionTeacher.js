import { scheduleSupabase } from "./api.js";
import { sendPushEvent } from "../pushNotifications.js";

function dayBefore(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slotStillActiveOnOrAfter(slot, transferDate) {
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (to && to < transferDate) return false;
  return true;
}

/**
 * 수업 선생님 이관 (assignments.role = teacher).
 * - 수업 시간표만 이관 (체크 시)
 * - 교구 순환·급여 단가·담당 관리자(manager_id)는 변경하지 않음
 */
export async function transferInstitutionTeacher({
  institutionId,
  institutionName,
  fromTeacherId,
  toTeacherId,
  transferDate,
  transferWeeklySchedule = true,
  fromPayTypes = ["정규", "방과후"],
}) {
  if (!institutionId || !fromTeacherId || !toTeacherId) {
    throw new Error("기관과 수업 선생님을 확인해 주세요.");
  }
  if (fromTeacherId === toTeacherId) {
    throw new Error("현재 선생님과 같은 선생님으로는 변경할 수 없습니다.");
  }
  const startDay = String(transferDate || "").slice(0, 10);
  if (!startDay) throw new Error("이관 시작일을 입력해 주세요.");

  let weeklyTransferred = 0;

  if (transferWeeklySchedule) {
    const { data: slots, error } = await scheduleSupabase
      .from("institution_weekly_schedule")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("teacher_id", fromTeacherId);
    if (error) throw error;

    const activeSlots = (slots || []).filter(s => slotStillActiveOnOrAfter(s, startDay));
    const prevDay = dayBefore(startDay);

    for (const slot of activeSlots) {
      const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
      const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;

      if (from && from >= startDay) {
        const { error: upErr } = await scheduleSupabase
          .from("institution_weekly_schedule")
          .update({ teacher_id: toTeacherId })
          .eq("id", slot.id);
        if (upErr) throw upErr;
        weeklyTransferred++;
        continue;
      }

      const { error: endErr } = await scheduleSupabase
        .from("institution_weekly_schedule")
        .update({ effective_to: prevDay })
        .eq("id", slot.id);
      if (endErr) throw endErr;

      const { error: insErr } = await scheduleSupabase
        .from("institution_weekly_schedule")
        .insert({
          institution_id: slot.institution_id,
          teacher_id: toTeacherId,
          day_of_week: slot.day_of_week,
          class_type: slot.class_type,
          start_time: slot.start_time,
          end_time: slot.end_time,
          label: slot.label ?? null,
          sort_order: slot.sort_order ?? 0,
          effective_from: startDay,
          effective_to: to && to >= startDay ? to : null,
        });
      if (insErr) throw insErr;
      weeklyTransferred++;
    }
  }

  // 기존 수업 선생님 배정 해제 (manager 행은 유지)
  const { error: deactErr } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .update({ is_active: false })
    .eq("institution_id", institutionId)
    .eq("teacher_id", fromTeacherId)
    .eq("role", "teacher");
  if (deactErr) throw deactErr;

  // 새 수업 선생님 배정
  const { data: existingTo } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .select("id, role")
    .eq("institution_id", institutionId)
    .eq("teacher_id", toTeacherId)
    .maybeSingle();

  if (existingTo?.role === "manager") {
    // 담당자 겸 수업 → teacher 역할로 전환 (manager_id는 그대로)
    const { error } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .update({
        role: "teacher",
        is_active: true,
        pay_types: fromPayTypes?.length ? fromPayTypes : ["정규", "방과후"],
      })
      .eq("id", existingTo.id);
    if (error) throw error;
  } else {
    const { error: assignErr } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .upsert(
        {
          institution_id: institutionId,
          teacher_id: toTeacherId,
          pay_types: fromPayTypes?.length ? fromPayTypes : ["정규", "방과후"],
          is_active: true,
          role: "teacher",
        },
        { onConflict: "institution_id,teacher_id" },
      );
    if (assignErr) throw assignErr;
  }

  const name = institutionName || "기관";

  try {
    await sendPushEvent(scheduleSupabase, "institution_teacher_assigned", {
      teacher_id: toTeacherId,
      body: `${name} 담당이 배정됐습니다`,
      institution_name: name,
    });
  } catch (e) {
    console.warn("new teacher push failed", e);
  }

  try {
    await sendPushEvent(scheduleSupabase, "institution_teacher_changed", {
      teacher_id: fromTeacherId,
      body: `${name} 담당이 변경됐습니다`,
      institution_name: name,
    });
  } catch (e) {
    console.warn("old teacher push failed", e);
  }

  return { weeklyTransferred };
}
