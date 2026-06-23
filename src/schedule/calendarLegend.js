import { homeVisitColor, institutionColor, isHomeVisitPlanned } from "./constants.js";

/**
 * 캘린더 범례용 원 목록.
 * institutions join(RLS)이 비어도 get_teacher_assigned_institutions 이름으로 표시.
 */
export function buildInstitutionLegend({
  weeklySlots = [],
  scheduleByDate = {},
  assignedInstitutions = [],
}) {
  const nameById = new Map();
  for (const inst of assignedInstitutions) {
    if (inst?.id && inst?.name) nameById.set(inst.id, inst.name);
  }
  for (const s of weeklySlots) {
    const id = s.institution_id || s.institutions?.id;
    const name = s.institutions?.name;
    if (id && name) nameById.set(id, name);
  }
  for (const planned of Object.values(scheduleByDate).flat()) {
    if (isHomeVisitPlanned(planned)) continue;
    if (planned.institutionId && planned.institutionName) {
      nameById.set(planned.institutionId, planned.institutionName);
    }
  }

  const ids = new Set();
  for (const s of weeklySlots) {
    const id = s.institution_id || s.institutions?.id;
    if (id) ids.add(id);
  }
  for (const inst of assignedInstitutions) {
    if (inst?.id) ids.add(inst.id);
  }
  for (const planned of Object.values(scheduleByDate).flat()) {
    if (!isHomeVisitPlanned(planned) && planned.institutionId) {
      ids.add(planned.institutionId);
    }
  }

  return [...ids]
    .map(id => ({
      id,
      name: nameById.get(id) || "원",
      color: institutionColor(id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function buildHomeVisitLegend(patterns = []) {
  const seen = new Set();
  const items = [];
  for (const p of patterns) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    items.push({
      id: p.id,
      name: p.student_name || "가정방문",
      color: homeVisitColor(p.id),
    });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 상세 패널 등 — join 이름 없을 때 범례/배정 원 이름으로 표시 */
export function resolveInstitutionDisplayName(planned, institutionLegend = []) {
  if (isHomeVisitPlanned(planned)) return null;
  if (planned.institutionName) return planned.institutionName;
  return institutionLegend.find(i => i.id === planned.institutionId)?.name || "원";
}
