import { formatMinutes } from "./constants.js";

/** 이 분을 넘기면 저장 전에 한 번 더 확인한다. 2시간 정각은 확인하지 않는다. */
export const LONG_CLASS_CONFIRM_OVER_MINUTES = 120;

export function longClassConfirmMessage(minutes) {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= LONG_CLASS_CONFIRM_OVER_MINUTES) return null;
  return `정말 ${formatMinutes(mins)}이 맞습니까?`;
}

export function confirmLongClassMinutes(minutes) {
  const message = longClassConfirmMessage(minutes);
  if (!message) return true;
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(message);
}

/** 2시간을 넘는 수업마다 확인한다. 하나라도 취소하면 false. */
export function confirmLongClassMinuteList(minutesList) {
  for (const minutes of minutesList || []) {
    if (!confirmLongClassMinutes(minutes)) return false;
  }
  return true;
}
