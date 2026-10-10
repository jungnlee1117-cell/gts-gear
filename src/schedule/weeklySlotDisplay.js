import {
  DAY_LABELS,
  classTypeLabel,
  minutesBetween,
  resolveInstitutionSlotPayType,
} from "./constants.js";

export function formatSlotTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

export function formatSlotDateShort(value) {
  if (!value) return "—";
  const [, month, day] = String(value).slice(0, 10).split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function formatSlotChangedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function classGroupFromStoredLabel(label) {
  const raw = String(label || "").trim();
  if (!raw || raw === "센터보조") return "";
  if (raw.startsWith("센터보조 ")) return raw.slice("센터보조 ".length).trim();
  return raw;
}

export function slotMinutes(slot) {
  return minutesBetween(formatSlotTime(slot.start_time), formatSlotTime(slot.end_time));
}

export function slotChangeSummary(slot, teacherName) {
  if (!slot) return "—";
  const classGroup = classGroupFromStoredLabel(slot.label);
  const name = typeof teacherName === "function"
    ? teacherName(slot.teacher_id)
    : teacherName;
  return [
    `${DAY_LABELS[slot.day_of_week] || ""} ${formatSlotTime(slot.start_time)}–${formatSlotTime(slot.end_time)}`.trim(),
    classTypeLabel(resolveInstitutionSlotPayType(slot)),
    slot.institutions?.name || null,
    classGroup || null,
    name || null,
  ].filter(Boolean).join(" · ");
}

export function slotTransferLine(slot) {
  const classGroup = classGroupFromStoredLabel(slot.label);
  const type = classTypeLabel(resolveInstitutionSlotPayType(slot));
  const time = `${formatSlotTime(slot.start_time)}~${formatSlotTime(slot.end_time)}`;
  const day = DAY_LABELS[slot.day_of_week] || "";
  return `${day} ${time}${classGroup ? ` ${classGroup}` : ""} · ${type}`;
}
