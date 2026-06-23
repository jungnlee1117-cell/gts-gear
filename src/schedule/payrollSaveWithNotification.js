import {
  bulkUpsertPayrollSlots,
  createScheduleChangeNotification,
  upsertPayrollSlot,
} from "./api.js";
import {
  buildExtraAddedNotificationRow,
  buildScheduleChangeNotificationRow,
  shouldNotifyExtraAdded,
  shouldNotifyScheduleChange,
} from "./scheduleChangeNotifications.js";

async function notifyIfNeeded(planned, payload, handlingExtra = {}) {
  if (!shouldNotifyScheduleChange(planned, payload, handlingExtra)) return;
  try {
    await createScheduleChangeNotification(
      buildScheduleChangeNotificationRow(planned, payload, handlingExtra),
    );
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

export async function createManualExtraEntryWithNotification(payload, { institutionName } = {}) {
  const entry = await upsertPayrollSlot(payload);
  if (shouldNotifyExtraAdded(payload)) {
    try {
      await createScheduleChangeNotification(
        buildExtraAddedNotificationRow(payload, { institutionName }),
      );
    } catch (err) {
      console.error("extra added notification failed:", err);
    }
  }
  return entry;
}

/** @deprecated use bulkUpsertPayrollSlotsWithNotifications for teacher saves */
export { bulkUpsertPayrollSlots };
