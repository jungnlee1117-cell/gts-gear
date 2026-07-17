import {
  createScheduleChangeNotification,
  deletePayrollEntry,
  insertOneoffLesson,
  savePayrollEntry,
  scheduleSupabase,
  updateOneoffLesson,
} from "./api.js";
import { ENTRY_STATUS } from "./payrollCalendar.js";
import { oneoffLessonMinutes } from "./oneoffLessons.js";
import { buildExtraAddedNotificationRow } from "./scheduleChangeNotifications.js";

/**
 * 일회성 수업 신규 등록을 변동 내역(스케줄 외 추가)에 기록. 실패해도 등록은 유지.
 * markNotificationRead: 일일등록 탭(관리자)에서만 true — 처음부터 확인됨으로 저장.
 */
async function notifyOneoffLessonAdded(lesson, payType, { markNotificationRead = false } = {}) {
  try {
    const row = buildExtraAddedNotificationRow({
      teacher_id: lesson.teacher_id,
      institution_id: lesson.institution_id,
      class_date: lesson.lesson_date,
      pay_type: payType,
      minutes: oneoffLessonMinutes(lesson),
    }, { institutionName: lesson.institutions?.name });
    if (markNotificationRead) {
      row.is_read = true;
      row.read_at = new Date().toISOString();
    }
    await createScheduleChangeNotification(row);
  } catch (err) {
    console.error("oneoff lesson change notification failed:", err);
  }
}

async function syncOneoffPayroll(lesson, { linkPayroll, payType = "정규" }) {
  const minutes = oneoffLessonMinutes(lesson);
  if (!linkPayroll) {
    if (lesson.payroll_entry_id) {
      await deletePayrollEntry(lesson.payroll_entry_id);
    }
    return null;
  }
  if (minutes <= 0) throw new Error("수업 시간을 확인해 주세요.");

  const payload = {
    teacher_id: lesson.teacher_id,
    institution_id: lesson.institution_id,
    class_date: lesson.lesson_date,
    pay_type: payType,
    minutes,
    entry_status: ENTRY_STATUS.as_scheduled,
    note: "일회성 수업",
  };
  if (lesson.payroll_entry_id) {
    payload.id = lesson.payroll_entry_id;
  }
  const entry = await savePayrollEntry(payload);
  return entry.id;
}

export async function registerOneoffLesson({
  me,
  teacherId,
  lessonDate,
  startTime,
  endTime,
  institutionId,
  memo = "",
  linkPayroll = false,
  payAmount = null,
  payType = "정규",
  markNotificationRead = false,
}) {
  const lesson = await insertOneoffLesson({
    teacher_id: teacherId,
    lesson_date: lessonDate,
    start_time: startTime,
    end_time: endTime,
    institution_id: institutionId,
    memo: memo.trim() || null,
    link_payroll: Boolean(linkPayroll),
    pay_amount: payAmount != null && payAmount !== "" ? Math.round(Number(payAmount)) : null,
    created_by: me?.id,
  });

  await notifyOneoffLessonAdded(lesson, payType, { markNotificationRead });

  if (linkPayroll) {
    const payrollEntryId = await syncOneoffPayroll(lesson, { linkPayroll, payType });
    if (payrollEntryId && payrollEntryId !== lesson.payroll_entry_id) {
      return updateOneoffLesson(lesson.id, { payroll_entry_id: payrollEntryId });
    }
  }
  return lesson;
}

export async function saveOneoffLesson({
  me,
  lesson,
  lessonDate,
  startTime,
  endTime,
  institutionId,
  memo = "",
  linkPayroll = false,
  payAmount = null,
  payType = "정규",
}) {
  const updated = await updateOneoffLesson(lesson.id, {
    lesson_date: lessonDate,
    start_time: startTime,
    end_time: endTime,
    institution_id: institutionId,
    memo: memo.trim() || null,
    link_payroll: Boolean(linkPayroll),
    pay_amount: payAmount != null && payAmount !== "" ? Math.round(Number(payAmount)) : null,
    updated_at: new Date().toISOString(),
  });

  const payrollEntryId = await syncOneoffPayroll(
    { ...updated, payroll_entry_id: lesson.payroll_entry_id },
    { linkPayroll, payType },
  );
  if (payrollEntryId !== updated.payroll_entry_id) {
    return updateOneoffLesson(updated.id, { payroll_entry_id: payrollEntryId });
  }
  if (!linkPayroll && lesson.payroll_entry_id) {
    return updateOneoffLesson(updated.id, { payroll_entry_id: null });
  }
  return updated;
}

export async function deleteOneoffLessonRecord(lesson) {
  if (lesson.payroll_entry_id) {
    await deletePayrollEntry(lesson.payroll_entry_id);
  }
  const { error } = await scheduleSupabase
    .from("oneoff_lessons")
    .delete()
    .eq("id", lesson.id);
  if (error) throw error;
}
