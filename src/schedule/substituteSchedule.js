import { formatShortDateRange } from "./temporaryTeachers.js";

export function dateInSubstituteRange(dateStr, assignment) {
  if (!assignment?.substitute_start_date || !dateStr) return false;
  const start = assignment.substitute_start_date.slice(0, 10);
  const end = assignment.substitute_end_date?.slice(0, 10) || "9999-12-31";
  return dateStr >= start && dateStr <= end;
}

export function findSubstituteForPlanned(planned, dateStr, assignments) {
  if (planned.source !== "institution") return null;
  return (assignments || []).find(a =>
    a.is_substitute
    && a.is_active !== false
    && a.institution_id === planned.institutionId
    && dateInSubstituteRange(dateStr, a)
    && (!a.pay_type || a.pay_type === planned.payType),
  ) ?? null;
}

export function applySubstituteToPlanned(planned, assignment) {
  if (!assignment) return planned;
  const inst = planned.institutionName || "";
  const substituteLabel = `대체: ${assignment.name} 선생님`;
  return {
    ...planned,
    displayLabel: inst ? `${inst} · ${substituteLabel}` : substituteLabel,
    substituteTempTeacher: assignment,
    isSubstituteCovered: true,
  };
}

export function applySubstituteOverlaysToSchedule(scheduleByDate, assignments) {
  const result = {};
  for (const [dateStr, list] of Object.entries(scheduleByDate || {})) {
    result[dateStr] = (list || []).map(p => {
      const sub = findSubstituteForPlanned(p, dateStr, assignments);
      return applySubstituteToPlanned(p, sub);
    });
  }
  return result;
}

export function enrichWeeklyItemsWithSubstitutes(items, assignments) {
  return (items || []).map(item => {
    if (item.source !== "institution") return item;
    const instId = item.raw?.institution_id;
    const matches = (assignments || []).filter(a =>
      a.is_substitute
      && a.is_active !== false
      && a.institution_id === instId,
    );
    if (!matches.length) return item;
    const substituteNote = matches
      .map(a => `대체: ${a.name} 선생님 (${formatShortDateRange(a.substitute_start_date, a.substitute_end_date)})`)
      .join(" · ");
    return { ...item, substituteNote };
  });
}
