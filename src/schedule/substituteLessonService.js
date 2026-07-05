import {
  bulkUpsertPayrollSlots,
  createScheduleChangeNotification,
  deletePayrollEntry,
  fetchPayRates,
  findPayrollEntryBySlot,
  insertSubstituteLesson,
  scheduleSupabase,
  updateSubstituteLessonStatus,
} from "./api.js";
import { sendPushEvent } from "../pushNotifications.js";
import { resolveInstitutionSlotBillableMinutes } from "./constants.js";
import {
  buildSubstituteChangeNotification,
  buildSubstitutePayrollPayloads,
  computeSubstitutePayAmount,
  formatSubstitutePushOriginal,
  formatSubstitutePushSubstitute,
  parseMonthDayTimeLabel,
  timeSlotFromPlanned,
} from "./substituteLessons.js";

async function notifySubstituteLessonPush({ originalTeacherId, substituteTeacherId, bodyOriginal, bodySubstitute }) {
  try {
    await sendPushEvent(scheduleSupabase, "substitute_lesson", {
      teacher_id: originalTeacherId,
      body: bodyOriginal,
    });
    if (substituteTeacherId) {
      await sendPushEvent(scheduleSupabase, "substitute_lesson", {
        teacher_id: substituteTeacherId,
        body: bodySubstitute,
      });
    }
  } catch (err) {
    console.error("substitute lesson push failed:", err);
  }
}

export async function registerSubstituteLesson({
  me,
  planned,
  originalTeacherId,
  substituteTeacherId = null,
  substituteTempTeacherId = null,
  substituteTempTeacher = null,
  lessonDate,
  reason = "",
  teachersById = {},
}) {
  const timeSlot = timeSlotFromPlanned(planned) || planned?.time_slot || "";
  const scheduledMinutes = Number(planned?.scheduledMinutes)
    || (planned?.slot ? resolveInstitutionSlotBillableMinutes(planned.slot) : 0)
    || 0;
  const payType = planned?.payType || planned?.pay_type || "정규";
  const institutionId = planned?.institutionId || planned?.institution_id;
  const scheduleSlotId = planned?.slot?.id || planned?.schedule_slot_id || null;

  const rates = await fetchPayRates();
  const substitutePayAmount = computeSubstitutePayAmount({
    substituteTeacherId,
    substituteTempTeacher,
    planned,
    rates,
    lessonDate,
  });

  const originalName = teachersById[originalTeacherId]?.name
    || planned?.teacherName
    || "선생님";
  const substituteName = substituteTeacherId
    ? (teachersById[substituteTeacherId]?.name || "대체 선생님")
    : (substituteTempTeacher?.name || "임시 선생님");

  const lesson = await insertSubstituteLesson({
    original_teacher_id: originalTeacherId,
    substitute_teacher_id: substituteTeacherId,
    substitute_temp_teacher_id: substituteTempTeacherId,
    lesson_date: lessonDate,
    time_slot: timeSlot,
    institution_id: institutionId,
    schedule_slot_id: scheduleSlotId,
    pay_type: payType,
    scheduled_minutes: scheduledMinutes,
    reason: reason.trim() || null,
    status: "completed",
    substitute_pay_amount: substitutePayAmount,
    created_by: me?.id,
  });

  const payrollPayloads = buildSubstitutePayrollPayloads(
    { ...lesson, original_teacher: { name: originalName } },
    planned,
  );
  await bulkUpsertPayrollSlots(payrollPayloads);

  try {
    await createScheduleChangeNotification(
      buildSubstituteChangeNotification(planned, lesson, { originalName, substituteName }),
    );
  } catch (err) {
    console.error("substitute change notification failed:", err);
  }

  const { month, day, timeLabel } = parseMonthDayTimeLabel(lessonDate, timeSlot);
  await notifySubstituteLessonPush({
    originalTeacherId,
    substituteTeacherId,
    bodyOriginal: formatSubstitutePushOriginal({ month, day, timeLabel, substituteName }),
    bodySubstitute: formatSubstitutePushSubstitute({ month, day, timeLabel, originalName }),
  });

  return lesson;
}

async function revertSubstitutePayroll(lesson) {
  for (const teacherId of [lesson.original_teacher_id, lesson.substitute_teacher_id].filter(Boolean)) {
    const existing = await findPayrollEntryBySlot({
      teacher_id: teacherId,
      class_date: lesson.lesson_date,
      schedule_slot_id: lesson.schedule_slot_id,
    });
    if (existing?.id) await deletePayrollEntry(existing.id);
  }
}

export async function cancelSubstituteLesson(lesson) {
  await updateSubstituteLessonStatus(lesson.id, "cancelled");
  await revertSubstitutePayroll(lesson);
}

export async function deleteSubstituteLessonRecord(lesson) {
  await revertSubstitutePayroll(lesson);
  const { error } = await scheduleSupabase
    .from("substitute_lessons")
    .delete()
    .eq("id", lesson.id);
  if (error) throw error;
}
