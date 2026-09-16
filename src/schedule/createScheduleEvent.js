import { saveScheduleExceptionWithClasses } from "./api.js";
import {
  createScheduleEventNotice,
  deleteScheduleEventNotice,
  linkScheduleExceptionToNotice,
} from "./eventNoticeSync.js";
import { notifyEventScheduled } from "./pushScheduleNotification.js";

export async function createScheduleEvent({ payload, selectedClasses = [], author }) {
  const notice = await createScheduleEventNotice(payload, author);

  let savedException;
  try {
    savedException = await saveScheduleExceptionWithClasses(
      { ...payload, notice_id: notice.id },
      payload.exception_type === "class_cancelled" ? selectedClasses : [],
    );
  } catch (error) {
    await deleteScheduleEventNotice(notice.id).catch(() => {});
    throw error;
  }

  await linkScheduleExceptionToNotice(notice.id, savedException.id).catch(error => {
    console.warn("행사 공지 연결 ID 저장 실패:", error);
  });

  void notifyEventScheduled({
    institution_id: payload.institution_id,
    note: payload.note,
    event_date: payload.exception_date,
  });

  return savedException;
}
