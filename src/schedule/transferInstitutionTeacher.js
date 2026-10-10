import {
  createWeeklySlotVersion,
  deactivateAssignment,
  fetchAssignments,
  fetchWeeklySchedule,
  saveAssignment,
  saveWeeklySlot,
  scheduleSupabase,
} from "./api.js";
import { sendPushEvent } from "../pushNotifications.js";
import { DAY_LABELS, fmtLocalDate } from "./constants.js";
import { slotTransferLine } from "./weeklySlotDisplay.js";
import {
  openTeacherSlots,
  payTypesAfterSlotTransfer,
  slotPayType,
  slotTeacherChangePlan,
} from "./weeklySlotVersion.js";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import {
  TRANSFER_CLASS_TYPES,
  matchingSlotsForTransfer,
  resolveTransferClassType,
  slotStillActiveOnOrAfter,
} from "./transferTeacherScope.js";

export {
  TRANSFER_CLASS_TYPES,
  classTypesHeldByTeacher,
  matchingSlotsForTransfer,
  resolveTransferClassType,
} from "./transferTeacherScope.js";

function formatSlotSummary(slots) {
  const days = [];
  const seen = new Set();
  for (const s of slots || []) {
    const day = DAY_LABELS[Number(s.day_of_week)] ?? "";
    if (!day || seen.has(day)) continue;
    seen.add(day);
    days.push(day);
  }
  const count = (slots || []).length;
  if (!count) return "";
  days.sort((a, b) => DAY_LABELS.indexOf(a) - DAY_LABELS.indexOf(b));
  return `${days.join("·")} · ${count}개 수업`;
}

function teacherName(teacherId, teachers) {
  return teachers.find((t) => t.id === teacherId)?.name || "—";
}

function uniqueTypes(list) {
  const seen = new Set();
  const out = [];
  for (const type of list || []) {
    if (!type || seen.has(type)) continue;
    seen.add(type);
    out.push(type);
  }
  return out;
}

function formatTypeList(types) {
  return (types || []).filter(Boolean).join("·");
}

/**
 * 기관 시간표·배정에서 유형별 현재 담당을 묶는다.
 */
export function buildClassTypeTransferGroups({
  weekly = [],
  assignments = [],
  teachers = [],
  now = new Date(),
} = {}) {
  const today = now instanceof Date
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    : String(now).slice(0, 10);

  const classAssignments = filterClassTeacherAssignments(assignments);
  const byType = new Map();

  const ensure = (classType) => {
    if (!byType.has(classType)) {
      byType.set(classType, {
        classType,
        currentTeachers: new Map(),
        slots: [],
      });
    }
    return byType.get(classType);
  };

  for (const slot of weekly || []) {
    if (!slotStillActiveOnOrAfter(slot, today)) continue;
    const classType = resolveTransferClassType(slot);
    const group = ensure(classType);
    group.slots.push(slot);
    if (slot.teacher_id) {
      group.currentTeachers.set(slot.teacher_id, {
        id: slot.teacher_id,
        name: teacherName(slot.teacher_id, teachers),
      });
    }
  }

  for (const a of classAssignments) {
    for (const classType of a.pay_types || []) {
      const group = ensure(classType);
      if (a.teacher_id && !group.currentTeachers.has(a.teacher_id)) {
        group.currentTeachers.set(a.teacher_id, {
          id: a.teacher_id,
          name: a.teachers?.name || teacherName(a.teacher_id, teachers),
        });
      }
    }
  }

  return TRANSFER_CLASS_TYPES
    .filter((type) => byType.has(type))
    .map((classType) => {
      const group = byType.get(classType);
      const currentTeachers = [...group.currentTeachers.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      return {
        classType,
        currentTeachers,
        slots: group.slots,
        slotSummary: formatSlotSummary(group.slots),
      };
    });
}

function dayBefore(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function reassignWeeklySlot(slot, toTeacherId, startDay) {
  const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;

  if (from && from >= startDay) {
    const { error: upErr } = await scheduleSupabase
      .from("institution_weekly_schedule")
      .update({ teacher_id: toTeacherId })
      .eq("id", slot.id);
    if (upErr) throw upErr;
    return;
  }

  const { error: endErr } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .update({ effective_to: dayBefore(startDay) })
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
}

async function fetchTeacherAssignments(institutionId) {
  const { data, error } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .select("id, institution_id, teacher_id, pay_types, role, is_active")
    .eq("institution_id", institutionId)
    .eq("role", "teacher");
  if (error) throw error;
  return data || [];
}

async function upsertTeacherAssignment({ institutionId, teacherId, payTypes, existing }) {
  const types = uniqueTypes(payTypes);
  if (existing?.role === "manager") {
    const { error } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .update({
        role: "teacher",
        is_active: true,
        pay_types: types.length ? types : ["정규", "방과후"],
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  if (existing?.id) {
    const { error } = await scheduleSupabase
      .from("institution_teacher_assignments")
      .update({
        is_active: true,
        role: "teacher",
        pay_types: types.length ? types : existing.pay_types || ["정규", "방과후"],
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await scheduleSupabase
    .from("institution_teacher_assignments")
    .upsert(
      {
        institution_id: institutionId,
        teacher_id: teacherId,
        pay_types: types.length ? types : ["정규", "방과후"],
        is_active: true,
        role: "teacher",
      },
      { onConflict: "institution_id,teacher_id" },
    );
  if (error) throw error;
}

/**
 * 수업 유형별로 담당 선생님을 이관한다.
 * fromTeacherId가 있으면 그 선생님의 수업·배정만 넘기고, 같은 유형의 다른 선생님은 그대로 둔다.
 * fromTeacherId가 없으면 해당 유형의 기존 담당 전체를 새 선생님에게 모은다.
 *
 * @param {object} opts
 * @param {string|null} [opts.fromTeacherId]
 * @param {Array<{ classType: string, toTeacherId: string, transferDate?: string }>} opts.transfers
 */
export async function transferInstitutionTeachersByClassType({
  institutionId,
  institutionName,
  fromTeacherId = null,
  transfers = [],
  defaultTransferDate,
}) {
  if (!institutionId) throw new Error("기관을 확인해 주세요.");

  const planned = (transfers || [])
    .map((row) => ({
      classType: String(row.classType || "").trim(),
      toTeacherId: row.toTeacherId,
      transferDate: String(row.transferDate || defaultTransferDate || "").slice(0, 10),
    }))
    .filter((row) => row.classType && row.toTeacherId && row.transferDate);

  if (!planned.length) {
    throw new Error("변경할 수업 유형의 새 선생님을 선택해 주세요.");
  }

  const { data: slots, error: slotErr } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .select("*")
    .eq("institution_id", institutionId);
  if (slotErr) throw slotErr;

  const assignments = await fetchTeacherAssignments(institutionId);
  const assignmentByTeacher = new Map(assignments.map((a) => [a.teacher_id, a]));

  const addedByTo = new Map();
  const removedByFrom = new Map();
  let weeklyTransferred = 0;
  const transferredTypes = [];

  for (const row of planned) {
    const matchingSlots = matchingSlotsForTransfer(slots, {
      classType: row.classType,
      fromTeacherId,
      toTeacherId: row.toTeacherId,
      transferDate: row.transferDate,
    });

    const fromIds = new Set(matchingSlots.map((s) => s.teacher_id));
    for (const a of assignments) {
      if (fromTeacherId && a.teacher_id !== fromTeacherId) continue;
      if (!(a.pay_types || []).includes(row.classType)) continue;
      if (!a.teacher_id || a.teacher_id === row.toTeacherId) continue;
      if (a.is_active === false) continue;
      fromIds.add(a.teacher_id);
    }

    if (!fromIds.size && !matchingSlots.length) continue;

    for (const slot of matchingSlots) {
      await reassignWeeklySlot(slot, row.toTeacherId, row.transferDate);
      weeklyTransferred += 1;
    }

    if (!addedByTo.has(row.toTeacherId)) addedByTo.set(row.toTeacherId, new Set());
    addedByTo.get(row.toTeacherId).add(row.classType);

    for (const fromId of fromIds) {
      if (!removedByFrom.has(fromId)) removedByFrom.set(fromId, new Set());
      removedByFrom.get(fromId).add(row.classType);
    }

    transferredTypes.push(row.classType);
  }

  if (!transferredTypes.length) {
    throw new Error("선택한 유형의 담당이 이미 새 선생님과 동일합니다.");
  }

  const { data: remainingSlots, error: remainErr } = await scheduleSupabase
    .from("institution_weekly_schedule")
    .select("teacher_id, class_type, label, effective_to")
    .eq("institution_id", institutionId);
  if (remainErr) throw remainErr;

  const remainingTypesByTeacher = new Map();
  const today = String(defaultTransferDate || planned[0].transferDate).slice(0, 10);
  for (const slot of remainingSlots || []) {
    if (!slot.teacher_id) continue;
    if (!slotStillActiveOnOrAfter(slot, today)) continue;
    if (!remainingTypesByTeacher.has(slot.teacher_id)) {
      remainingTypesByTeacher.set(slot.teacher_id, new Set());
    }
    remainingTypesByTeacher.get(slot.teacher_id).add(resolveTransferClassType(slot));
  }

  for (const [fromId, removedTypes] of removedByFrom) {
    const existing = assignmentByTeacher.get(fromId);
    const remainingSlotTypes = [...(remainingTypesByTeacher.get(fromId) || [])]
      .filter((t) => !removedTypes.has(t));
    const keptPayTypes = uniqueTypes([
      ...(existing?.pay_types || []).filter((t) => !removedTypes.has(t)),
      ...remainingSlotTypes,
    ]);

    if (!keptPayTypes.length) {
      if (existing?.id) {
        const { error } = await scheduleSupabase
          .from("institution_teacher_assignments")
          .update({ is_active: false })
          .eq("id", existing.id)
          .eq("role", "teacher");
        if (error) throw error;
      }
      continue;
    }

    await upsertTeacherAssignment({
      institutionId,
      teacherId: fromId,
      payTypes: keptPayTypes,
      existing,
    });
  }

  for (const [toId, addedTypes] of addedByTo) {
    const existing = assignmentByTeacher.get(toId)
      || (await scheduleSupabase
        .from("institution_teacher_assignments")
        .select("id, institution_id, teacher_id, pay_types, role, is_active")
        .eq("institution_id", institutionId)
        .eq("teacher_id", toId)
        .maybeSingle()).data;
    const removed = removedByFrom.get(toId) || new Set();
    const nextTypes = uniqueTypes([
      ...(existing?.pay_types || []).filter((t) => !removed.has(t)),
      ...addedTypes,
      ...(remainingTypesByTeacher.get(toId) || []),
    ]);
    await upsertTeacherAssignment({
      institutionId,
      teacherId: toId,
      payTypes: nextTypes,
      existing,
    });
  }

  const name = institutionName || "기관";

  for (const [toId, addedTypes] of addedByTo) {
    const typeLabel = formatTypeList([...addedTypes]);
    try {
      await sendPushEvent(scheduleSupabase, "institution_teacher_assigned", {
        teacher_id: toId,
        body: `${name} ${typeLabel} 수업이 배정됐습니다`,
        institution_name: name,
        class_types: [...addedTypes],
      });
    } catch (e) {
      console.warn("new teacher push failed", e);
    }
  }

  for (const [fromId, removedTypes] of removedByFrom) {
    if (addedByTo.has(fromId)) continue;
    const typeLabel = formatTypeList([...removedTypes]);
    try {
      await sendPushEvent(scheduleSupabase, "institution_teacher_changed", {
        teacher_id: fromId,
        body: `${name} ${typeLabel} 담당이 변경됐습니다`,
        institution_name: name,
        class_types: [...removedTypes],
      });
    } catch (e) {
      console.warn("old teacher push failed", e);
    }
  }

  return {
    weeklyTransferred,
    transferredTypes,
    newTeacherIds: [...addedByTo.keys()],
  };
}

function slotVersionPayload(slot, toTeacherId) {
  return {
    institution_id: slot.institution_id,
    teacher_id: toTeacherId,
    day_of_week: slot.day_of_week,
    class_type: slot.class_type,
    start_time: slot.start_time,
    end_time: slot.end_time,
    label: slot.label ?? null,
    sort_order: slot.sort_order ?? 0,
  };
}

async function syncRosterAfterSlotTransfer({
  institutionId,
  institutionName,
  fromTeacherId,
  toTeacherId,
  transferred,
}) {
  const today = fmtLocalDate(new Date());
  const [weekly, assignments] = await Promise.all([
    fetchWeeklySchedule(institutionId),
    fetchAssignments(institutionId, { activeOnly: false }),
  ]);
  const fromRow = (assignments || []).find((row) => row.teacher_id === fromTeacherId) || null;
  const toRow = (assignments || []).find((row) => row.teacher_id === toTeacherId) || null;
  const remaining = openTeacherSlots(weekly, {
    teacherId: fromTeacherId,
    institutionId,
    today,
  });
  const toIsActive = toRow?.is_active !== false;
  const next = payTypesAfterSlotTransfer({
    fromPayTypes: fromRow?.pay_types || [],
    toPayTypes: toIsActive ? (toRow?.pay_types || []) : [],
    transferredTypes: transferred.map(slotPayType),
    remainingTypes: remaining.map(slotPayType),
    fromHasOpenSlots: remaining.length > 0,
  });

  if (next.toPayTypes.length) {
    await saveAssignment({
      institution_id: institutionId,
      teacher_id: toTeacherId,
      pay_types: next.toPayTypes,
      role: "teacher",
    });
  }

  if (fromRow?.role === "teacher") {
    if (next.deactivateFrom) {
      await deactivateAssignment(fromRow.id);
    } else if (next.fromPayTypes.length) {
      await saveAssignment({
        institution_id: institutionId,
        teacher_id: fromTeacherId,
        pay_types: next.fromPayTypes,
        role: "teacher",
      });
    }
  }

  const name = institutionName || "기관";
  const typeLabel = formatTypeList(next.toPayTypes);
  try {
    await sendPushEvent(scheduleSupabase, "institution_teacher_assigned", {
      teacher_id: toTeacherId,
      body: `${name} ${typeLabel} 수업이 배정됐습니다`,
      institution_name: name,
      class_types: next.toPayTypes,
    });
  } catch (e) {
    console.warn("new teacher push failed", e);
  }
  if (next.deactivateFrom && fromTeacherId !== toTeacherId) {
    try {
      await sendPushEvent(scheduleSupabase, "institution_teacher_changed", {
        teacher_id: fromTeacherId,
        body: `${name} 담당 수업이 변경됐습니다`,
        institution_name: name,
        class_types: transferred.map(slotPayType),
      });
    } catch (e) {
      console.warn("old teacher push failed", e);
    }
  }
}

/**
 * 선택한 시간표 슬롯만 다른 선생님에게 넘긴다.
 * 시간표 수정과 같이 기존 행을 닫고 같은 schedule_series_id의 새 행을 만든다.
 */
export async function transferSelectedWeeklySlots({
  slots,
  toTeacherId,
  transferDate,
  changedBy = null,
  institutionId,
  institutionName,
  fromTeacherId,
}) {
  if (!institutionId) throw new Error("기관을 확인해 주세요.");
  if (!fromTeacherId) throw new Error("교체할 선생님을 찾을 수 없습니다.");
  if (!toTeacherId) throw new Error("새 선생님을 선택해 주세요.");
  const date = String(transferDate || "").slice(0, 10);
  if (!date) throw new Error("변경 적용일을 입력해주세요.");
  const selected = slots || [];
  if (!selected.length) throw new Error("교체할 수업을 선택해 주세요.");

  const today = fmtLocalDate(new Date());
  for (const slot of selected) {
    const plan = slotTeacherChangePlan(slot, date, today);
    if (!plan.ok) {
      throw new Error(`${slotTransferLine(slot)}: ${plan.message}`);
    }
    const next = slotVersionPayload(slot, toTeacherId);
    if (plan.mode === "inplace") {
      await saveWeeklySlot({
        ...next,
        id: slot.id,
        effective_from: slot.effective_from || null,
        effective_to: slot.effective_to || null,
        schedule_series_id: slot.schedule_series_id || slot.id,
        previous_slot_id: slot.previous_slot_id || null,
        change_reason: "선생님 교체",
        changed_by: changedBy,
        updated_at: new Date().toISOString(),
      });
      const { error: payrollError } = await scheduleSupabase
        .from("payroll_entries")
        .update({
          teacher_id: toTeacherId,
          updated_at: new Date().toISOString(),
        })
        .eq("schedule_slot_id", slot.id)
        .gte("class_date", date);
      if (payrollError) throw payrollError;
    } else {
      await createWeeklySlotVersion(slot, next, date, "선생님 교체", changedBy);
    }
  }

  await syncRosterAfterSlotTransfer({
    institutionId,
    institutionName,
    fromTeacherId,
    toTeacherId,
    transferred: selected,
  });

  return { weeklyTransferred: selected.length };
}
