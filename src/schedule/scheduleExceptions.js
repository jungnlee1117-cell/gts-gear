import { DAY_LABELS, EXCEPTION_LABELS, yearMonthLastDay, fmtLocalDate } from "./constants.js";

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function exceptionEndDate(ex) {
  return ex.end_date || ex.exception_date;
}

export function isExceptionActiveOnDate(ex, dateStr) {
  return ex.exception_date <= dateStr && dateStr <= exceptionEndDate(ex);
}

export function isInstitutionCancelledOnDate(exceptions, institutionId, dateStr) {
  return exceptions.some(ex =>
    ex.institution_id === institutionId
    && ex.exception_type === "cancelled"
    && isExceptionActiveOnDate(ex, dateStr),
  );
}

export function daysInclusive(startStr, endStr) {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function formatShortDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatExceptionNotice(ex) {
  const note = ex.note?.trim() || EXCEPTION_LABELS[ex.exception_type] || "안내";
  const end = exceptionEndDate(ex);
  if (ex.end_date && ex.end_date !== ex.exception_date) {
    const days = daysInclusive(ex.exception_date, end);
    const nights = days - 1;
    return `${formatShortDate(ex.exception_date)}~${formatShortDate(end)} (${nights}박${days}일) ${note}`;
  }
  const d = parseLocalDate(ex.exception_date);
  return `${formatShortDate(ex.exception_date)} (${DAY_LABELS[d.getDay()]}) ${note}`;
}

export function filterExceptionsForMonth(exceptions, year, month) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = yearMonthLastDay(monthKey);
  return exceptions
    .filter(ex => ex.exception_date <= monthEnd && exceptionEndDate(ex) >= monthStart)
    .sort((a, b) => a.exception_date.localeCompare(b.exception_date));
}

export function exceptionsForDate(exceptions, dateStr) {
  return exceptions.filter(ex => isExceptionActiveOnDate(ex, dateStr));
}

export function buildExceptionsByDateMap(exceptions, monthStart, monthEnd) {
  const map = {};
  for (const ex of exceptions) {
    const end = exceptionEndDate(ex);
    let cur = ex.exception_date;
    while (cur <= end) {
      if (cur >= monthStart && cur <= monthEnd) {
        if (!map[cur]) map[cur] = [];
        if (!map[cur].some(e => e.id === ex.id)) map[cur].push(ex);
      }
      const [cy, cm, cd] = cur.split("-").map(Number);
      cur = fmtLocalDate(new Date(cy, cm - 1, cd + 1));
    }
  }
  return map;
}

export function exceptionBadgeLabel(ex) {
  const note = ex.note?.trim();
  if (note) return note;
  return EXCEPTION_LABELS[ex.exception_type] || "안내";
}

export function filterExceptionsForInstitutions(exceptions, institutionIds) {
  if (!institutionIds?.size) return [];
  return exceptions.filter(ex => institutionIds.has(ex.institution_id));
}
