import { sendPushEvent } from "../pushNotifications.js";
import { scheduleSupabase } from "./api.js";

/** 행사·휴원 일정 등록 시 담당 강사 푸시 */
export async function notifyEventScheduled(payload) {
  return sendPushEvent(scheduleSupabase, "event_scheduled", payload);
}
