import {
  bulkUpsertPayrollSlots,
  createScheduleChangeNotification,
  scheduleSupabase,
  upsertPayrollSlot,
} from "./api.js";
import { formatWon } from "./constants.js";
import { sendPushEvent } from "../pushNotifications.js";
import {
  buildExtraAddedNotificationRow,
  buildScheduleChangeNotificationRow,
  shouldNotifyExtraAdded,
  shouldNotifyScheduleChange,
} from "./scheduleChangeNotifications.js";

function formatClassDateShort(dateStr) {
  const [, m, d] = String(dateStr || "").split("-").map(Number);
  if (!m || !d) return dateStr || "";
  return `${m}월 ${d}일`;
}

async function pushScheduleChangeAlert(planned, payload, { institutionName } = {}) {
  const inst = institutionName
    || planned?.institutionName
    || (payload.institution_id ? "원" : "개인레슨");
  await sendPushEvent(scheduleSupabase, "schedule_change", {
    teacher_id: payload.teacher_id,
    institution_name: inst,
    class_date: payload.class_date,
  });
}

async function pushExtraLessonRegistered({
  teacherId,
  teacherName,
  classDate,
  classType,
  amount,
}) {
  const name = String(teacherName || "").trim() || "선생님";
  const dateLabel = formatClassDateShort(classDate);
  const typeLabel = String(classType || "수업").trim() || "수업";
  const amountLabel = Number(amount) > 0 ? formatWon(Number(amount)) : "금액 미정";
  const body = `${name}님이 추가수업/수당을 등록했어요: ${dateLabel} ${typeLabel} ${amountLabel}`;
  await sendPushEvent(scheduleSupabase, "extra_lesson_registered", {
    teacher_id: teacherId,
    teacher_name: name,
    class_date: classDate,
    class_type: typeLabel,
    amount: Number(amount) || 0,
    body,
  });
}

async function notifyIfNeeded(planned, payload, handlingExtra = {}) {
  if (!shouldNotifyScheduleChange(planned, payload, handlingExtra)) return;
  try {
    await createScheduleChangeNotification(
      buildScheduleChangeNotificationRow(planned, payload, handlingExtra),
    );
    await pushScheduleChangeAlert(planned, payload);
  } catch (err) {
    console.error("schedule change notification failed:", err);
    // 급여 저장은 성공했지만 알림만 실패한 경우 — 콘솔에 원인 노출
  }
}

export async function upsertPayrollSlotWithNotification(planned, payload, handlingExtra = {}) {
  const entry = await upsertPayrollSlot(payload);
  await notifyIfNeeded(planned, payload, handlingExtra);
  return entry;
}

export async function bulkUpsertPayrollSlotsWithNotifications(items) {
  const results = [];
  for (const { planned, payload, handlingExtra } of items) {
    const entry = await upsertPayrollSlot(payload);
    await notifyIfNeeded(planned, payload, handlingExtra);
    results.push(entry);
  }
  return results;
}

export async function createManualExtraEntryWithNotification(
  payload,
  {
    institutionName,
    changeReason,
    teacherName = "",
    classType = "",
    amount = 0,
    skipPush = false,
  } = {},
) {
  const entry = await upsertPayrollSlot(payload);
  if (shouldNotifyExtraAdded(payload)) {
    try {
      await createScheduleChangeNotification(
        buildExtraAddedNotificationRow(payload, { institutionName, changeReason }),
      );
      if (!skipPush) {
        await pushExtraLessonRegistered({
          teacherId: payload.teacher_id,
          teacherName,
          classDate: payload.class_date,
          classType: classType || payload.pay_type || "수업",
          amount,
        });
      }
    } catch (err) {
      console.error("extra added notification failed:", err);
    }
  }
  return entry;
}

/** @deprecated use bulkUpsertPayrollSlotsWithNotifications for teacher saves */
export { bulkUpsertPayrollSlots };
