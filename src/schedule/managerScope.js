import { isScheduleAdmin } from "./roles.js";

/** 슈퍼관리자 — 27개 원 전체 */
export const isScheduleSuperAdmin = (me) => me?.role === "superadmin";

export const HQ_MANAGER_LABEL = "본사";
const HQ_MANAGER_NAMES = new Set(["정티쳐", "정티처"]);

function normalizeManagerName(name) {
  return String(name || "").replace(/\s/g, "");
}

/** 담당자 없음·슈퍼관리자·정티쳐는 본사 */
export function isHeadquartersManager(personOrName) {
  if (!personOrName) return true;
  if (typeof personOrName === "string") {
    return HQ_MANAGER_NAMES.has(normalizeManagerName(personOrName));
  }
  if (personOrName.role === "superadmin") return true;
  return HQ_MANAGER_NAMES.has(normalizeManagerName(personOrName.name));
}

export function formatInstitutionManagerLabel(personOrName, fallback = HQ_MANAGER_LABEL) {
  if (isHeadquartersManager(personOrName)) return fallback;
  if (typeof personOrName === "string") {
    return personOrName.trim() || fallback;
  }
  return String(personOrName.name || "").trim() || fallback;
}

export function regionalManagerOptions(teachers = []) {
  return (teachers || []).filter(t => !isHeadquartersManager(t));
}

export function isHeadquartersManagedInstitution(institution, managerMap) {
  if (!institution?.manager_id) return true;
  return isHeadquartersManager(managerMap?.[institution.manager_id]);
}

/** 정산 그룹 키 — 본사(없음·정티쳐)는 "none" */
export function institutionManagerGroupKey(institution, managerMap) {
  if (isHeadquartersManagedInstitution(institution, managerMap)) return "none";
  return institution?.manager_id || "none";
}

/** 일반 관리자(양의인·오정석 등) — manager_id 담당 원만 */
export const isScheduleRegionalManager = (me) =>
  me?.role === "admin" && !isScheduleSuperAdmin(me);

/** 관리자 — 급여/정산 대시보드 (슈퍼: 전체, 지역: 담당 원만) */
export function canAccessPayrollAdmin(me) {
  return isScheduleAdmin(me);
}

export function canSeeAllInstitutions(me) {
  return isScheduleSuperAdmin(me);
}

/** 원 목록 — 지역 관리자는 manager_id 담당 원만 */
export function filterInstitutionsForManagerScope(institutions, me) {
  if (isScheduleSuperAdmin(me)) return institutions || [];
  return (institutions || []).filter(i => institutionInManagerScope(i, me));
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
      return isHeadquartersManagedInstitution(row.institution, ids?.managerMap)
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
