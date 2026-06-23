import { isScheduleAdmin } from "./roles.js";

/** 슈퍼관리자 — 27개 원 전체 */
export const isScheduleSuperAdmin = (me) => me?.role === "superadmin";

/** 일반 관리자(양의인·오정석 등) — manager_id 담당 원만 */
export const isScheduleRegionalManager = (me) =>
  me?.role === "admin" && !isScheduleSuperAdmin(me);

export function canSeeAllInstitutions(me) {
  return isScheduleSuperAdmin(me);
}

/** manager_fixed_payout 원의 전체 매출·GTS 몫 — 슈퍼관리자만 */
export function canViewInstitutionRevenue(me, institution) {
  if (isScheduleSuperAdmin(me)) return true;
  if (!isScheduleRegionalManager(me)) return true;
  return institution?.contract_type !== "manager_fixed_payout";
}

export function canSeeGtsFixedPayoutSlice(me) {
  return isScheduleSuperAdmin(me);
}

export function institutionInManagerScope(institution, me) {
  if (!institution) return false;
  if (isScheduleSuperAdmin(me)) return true;
  if (!isScheduleRegionalManager(me)) return true;
  return institution.manager_id === me?.id;
}

export function resolveManagerFilterIds(managerMap) {
  const managers = Object.values(managerMap || {});
  return {
    yangId: managers.find(t => t.name === "양의인")?.id ?? null,
    ohId: managers.find(t => t.name === "오정석")?.id ?? null,
    selfId: null,
  };
}

/** PayrollAdminView 담당자 필터 — 지역 관리자는 자동 잠금 */
export function resolveLockedManagerFilter(me, managerMap) {
  if (isScheduleSuperAdmin(me)) return null;
  const ids = resolveManagerFilterIds(managerMap);
  if (me?.id === ids.yangId) return "yang";
  if (me?.id === ids.ohId) return "oh";
  if (isScheduleRegionalManager(me)) return "self";
  return "self";
}

export function filterInstitutionRowsForManagerScope(rows, managerFilter, ids, me) {
  return rows.filter(row => {
    if (managerFilter === "all") return true;
    if (managerFilter === "hq") {
      if (!canSeeAllInstitutions(me)) return false;
      return !row.institution.manager_id
        || row.institution.contract_type === "manager_fixed_payout";
    }
    if (managerFilter === "yang") return row.institution.manager_id === ids.yangId;
    if (managerFilter === "oh") return row.institution.manager_id === ids.ohId;
    if (managerFilter === "self") {
      return row.institution.manager_id === (ids.selfId ?? me?.id);
    }
    return true;
  });
}

export function filterTeachersForManagedInstitutions(teacherRows, institutionIds, entries) {
  if (!institutionIds?.size) return [];
  const idSet = institutionIds;
  return teacherRows.filter(row => {
    const tid = row.teacher.id;
    return entries.some(e =>
      e.teacher_id === tid && e.institution_id && idSet.has(e.institution_id),
    );
  });
}
