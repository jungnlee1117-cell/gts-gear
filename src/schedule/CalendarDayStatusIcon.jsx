import { AlertCircle, Check } from "lucide-react";
import { dayConfirmState } from "./payrollCalendar.js";

/** 캘린더 날짜 칸 우측 상단 아이콘 종류 */
export function calendarDayStatusKind(planned, entries, { isHoliday = false } = {}) {
  if (isHoliday || !planned?.length) return null;
  const state = dayConfirmState(planned, entries);
  if (state === "pending" || state === "partial") return "unconfirmed";
  if (state === "done" || state === "all_skipped" || state === "mixed") return "confirmed";
  return null;
}

export default function CalendarDayStatusIcon({ kind }) {
  if (!kind) return null;
  if (kind === "unconfirmed") {
    return (
      <span className="sch-cal-status-icon sch-cal-status-icon--alert" aria-hidden="true">
        <AlertCircle size={15} strokeWidth={2.75} />
      </span>
    );
  }
  return (
    <span className="sch-cal-status-icon sch-cal-status-icon--done" aria-hidden="true">
      <Check size={11} strokeWidth={3} />
    </span>
  );
}
