import { ENTRY_STATUS } from "./payrollCalendar.js";
import { estimateTeacherPayByEntry } from "./settlement.js";
import { formatOriginalSchedule } from "./scheduleChangeNotifications.js";
import { computeTempTeacherPay } from "./temporaryTeachers.js";

export const SUBSTITUTE_STATUS = {
  completed: "대체완료",
  cancelled: "취소",
};

export function timeSlotFromPlanned(planned) {
  if (!planned) return "";
  return `${planned.startTime}-${planned.endTime}`;
}

export function parseMonthDayTimeLabel(lessonDate, timeSlot) {
  const [, m, d] = String(lessonDate || "").split("-").map(Number);
  const timePart = String(timeSlot || "").split("-")[0]?.trim() || "";
  return { month: m, day: d, timeLabel: timePart };
}

export function formatSubstitutePushOriginal({ month, day, timeLabel, substituteName }) {
  return `${month}월 ${day}일 ${timeLabel} 수업이 ${substituteName} 선생님으로 대체됩니다`;
}

export function formatSubstitutePushSubstitute({ month, day, timeLabel, originalName }) {
  return `${month}월 ${day}일 ${timeLabel} ${originalName} 선생님 수업을 대체해주세요`;
}

export function lessonMatchesPlanned(lesson, planned, dateStr) {
  if (!lesson || lesson.status !== "completed") return false;
  if (lesson.lesson_date !== dateStr) return false;
  if (planned.source !== "institution") return false;
  if (lesson.schedule_slot_id && planned.slot?.id) {
    return lesson.schedule_slot_id === planned.slot.id;
  }
  return lesson.time_slot === timeSlotFromPlanned(planned)
    && lesson.institution_id === planned.institutionId;
}

export function applySubstituteLessonsToSchedule(scheduleByDate, lessons, { viewerTeacherId, institutionMap = {} }) {
  const result = {};
  for (const [dateStr, list] of Object.entries(scheduleByDate || {})) {
    result[dateStr] = (list || []).map(planned => {
      const asOriginal = (lessons || []).find(l =>
        l.original_teacher_id === viewerTeacherId
        && l.status === "completed"
        && lessonMatchesPlanned(l, planned, dateStr),
      );
      if (asOriginal) {
        const subName = asOriginal.substitute_teacher?.name
          || asOriginal.substitute_temp_teacher?.name
          || "대체 선생님";
        return {
          ...planned,
          isSubstituteCancelled: true,
          substituteLesson: asOriginal,
          displayLabel: `${planned.institutionName || "원"} · 휴강 🔴 (대체: ${subName})`,
        };
      }

      const asSubstitute = (lessons || []).find(l =>
        l.substitute_teacher_id === viewerTeacherId
        && l.status === "completed"
        && lessonMatchesPlanned(l, planned, dateStr),
      );
      if (asSubstitute) {
        const origName = asSubstitute.original_teacher?.name || "선생님";
        return {
          ...planned,
          isSubstituteCover: true,
          substituteLesson: asSubstitute,
          displayLabel: `${planned.institutionName || "원"} · 대체수업 🟡 (${origName})`,
        };
      }

      return planned;
    });
  }

  for (const lesson of lessons || []) {
    if (lesson.status !== "completed") continue;
    if (lesson.substitute_teacher_id !== viewerTeacherId) continue;
    const dateStr = lesson.lesson_date;
    const existing = result[dateStr] || scheduleByDate[dateStr] || [];
    const matched = existing.some(p => lessonMatchesPlanned(lesson, p, dateStr));
    if (matched) continue;
    const [startTime, endTime] = String(lesson.time_slot || "-").split("-").map(s => s.trim());
    const inst = institutionMap[lesson.institution_id] || lesson.institutions;
    const origName = lesson.original_teacher?.name || "선생님";
    const synthetic = {
      source: "institution",
      slot: { id: lesson.schedule_slot_id || `sub-${lesson.id}` },
      institutionId: lesson.institution_id,
      institutionName: inst?.name || "원",
      startTime: startTime || "",
      endTime: endTime || "",
      payType: lesson.pay_type || "정규",
      scheduledMinutes: Number(lesson.scheduled_minutes) || 0,
      dateStr,
      isSubstituteCover: true,
      substituteLesson: lesson,
      displayLabel: `${inst?.name || "원"} · 대체수업 🟡 (${origName})`,
    };
    result[dateStr] = [...(result[dateStr] || []), synthetic].sort((a, b) =>
      (a.startTime || "").localeCompare(b.startTime || ""),
    );
  }

  return result;
}

export function calendarSubstituteBadge(lessons, teacherId, dateStr) {
  const dayLessons = (lessons || []).filter(l =>
    l.status === "completed" && l.lesson_date === dateStr,
  );
  const cancelled = dayLessons.some(l => l.original_teacher_id === teacherId);
  const covering = dayLessons.some(l => l.substitute_teacher_id === teacherId);
  if (cancelled) return { kind: "cancelled", label: "휴강 🔴" };
  if (covering) return { kind: "cover", label: "대체수업 🟡" };
  return null;
}

export function computeSubstitutePayAmount({
  substituteTeacherId,
  substituteTempTeacher,
  planned,
  rates,
  lessonDate,
}) {
  const minutes = Number(planned?.scheduledMinutes) || 0;
  if (substituteTeacherId && rates?.length) {
    const entry = {
      teacher_id: substituteTeacherId,
      pay_type: planned.payType,
      class_date: lessonDate,
      minutes,
    };
    return estimateTeacherPayByEntry([entry], rates);
  }
  if (substituteTempTeacher) {
    if (substituteTempTeacher.pay_mode === "per_session") {
      return Number(substituteTempTeacher.rate_amount) || 0;
    }
    if (substituteTempTeacher.pay_mode === "hourly") {
      const hours = minutes / 60;
      return Math.round((Number(substituteTempTeacher.rate_amount) || 0) * hours);
    }
    if (substituteTempTeacher.pay_mode === "fixed_total") {
      return Number(substituteTempTeacher.rate_amount) || 0;
    }
    if (substituteTempTeacher.pay_mode === "daily") {
      return Number(substituteTempTeacher.rate_amount) || 0;
    }
    return computeTempTeacherPay(substituteTempTeacher);
  }
  return 0;
}

export function buildSubstituteChangeNotification(planned, lesson, { originalName, substituteName }) {
  return {
    teacher_id: lesson.original_teacher_id,
    institution_id: lesson.institution_id,
    class_date: lesson.lesson_date,
    schedule_slot_id: lesson.schedule_slot_id,
    pay_type: lesson.pay_type || planned?.payType || null,
    change_type: ENTRY_STATUS.skipped,
    original_schedule: planned ? formatOriginalSchedule(planned) : lesson.time_slot,
    actual_handling: `${substituteName} 선생님 대체`,
    change_reason: "대체 수업",
  };
}

export function buildSubstitutePayrollPayloads(lesson, planned) {
  const minutes = Number(lesson.scheduled_minutes) || Number(planned?.scheduledMinutes) || 0;
  const payType = lesson.pay_type || planned?.payType || "정규";
  const originalPayload = {
    teacher_id: lesson.original_teacher_id,
    institution_id: lesson.institution_id,
    class_date: lesson.lesson_date,
    schedule_slot_id: lesson.schedule_slot_id,
    pay_type: payType,
    minutes: 0,
    entry_status: ENTRY_STATUS.skipped,
    note: "대체수업",
  };
  const payloads = [originalPayload];

  if (lesson.substitute_teacher_id && minutes > 0) {
    payloads.push({
      teacher_id: lesson.substitute_teacher_id,
      institution_id: lesson.institution_id,
      class_date: lesson.lesson_date,
      schedule_slot_id: lesson.schedule_slot_id,
      pay_type: payType,
      minutes,
      entry_status: ENTRY_STATUS.custom,
      note: `대체수업 (${lesson.original_teacher?.name || "원래 선생님"})`,
    });
  }

  return payloads;
}

export function sumSubstituteLessonPayForTeacher(lessons, teacherId) {
  return (lessons || [])
    .filter(l =>
      l.status === "completed"
      && l.substitute_teacher_id === teacherId,
    )
    .reduce((s, l) => s + (Number(l.substitute_pay_amount) || 0), 0);
}

export function groupSubstituteLessonsByTempTeacher(lessons, yearMonth) {
  const prefix = String(yearMonth).slice(0, 7);
  const map = new Map();
  for (const l of lessons || []) {
    if (l.status !== "completed" || !l.substitute_temp_teacher_id) continue;
    if (!String(l.lesson_date).startsWith(prefix)) continue;
    const key = l.substitute_temp_teacher_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
  }
  return map;
}
