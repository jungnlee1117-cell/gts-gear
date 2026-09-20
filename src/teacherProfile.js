import { isGearOnlyAccess, isScheduleAdmin, isSuperAdmin, SUPER_ADMIN_ID } from "./authRoles.js";

export const TEACHER_CONTRACT_TYPES = ["정규직", "위탁계약", "파트타임"];
export const TEACHER_ACTIVITY_STATUSES = ["활동중", "휴직중", "계약종료"];
export const MY_PROFILE_TABS = [
  { id: "basic", label: "기본정보" },
  { id: "contract", label: "계약" },
  { id: "docs", label: "서류" },
  { id: "etc", label: "기타" },
];

export function canViewTeacherDocuments(me, teacherId) {
  if (!me?.id || !teacherId) return false;
  if (isGearOnlyAccess(me)) return false;
  if (me.id === teacherId) return true;
  return isScheduleAdmin(me);
}

export function canManageTeacherDocuments(me, teacherId) {
  return canViewTeacherDocuments(me, teacherId);
}

export function visibleMyProfileTabs(me, { teacherId } = {}) {
  const tabs = [{ id: "basic", label: "기본정보" }];
  const isSelf = Boolean(me?.id && teacherId && me.id === teacherId);
  if (isSelf || canUploadTeacherContract(me)) {
    tabs.push({ id: "contract", label: "계약" });
  }
  if (canViewTeacherDocuments(me, teacherId)) {
    tabs.push({ id: "docs", label: "서류" });
  }
  if (canUploadTeacherContract(me) || isSuperAdmin(me)) {
    tabs.push({ id: "etc", label: "기타" });
  }
  return tabs;
}

export function teacherActivityStatus(teacher) {
  if (teacher?.resigned_at) return "계약종료";
  if (teacher?.active === false) return "휴직중";
  return "활동중";
}

/** 선택 영역 배지: 강사 | 관리자 */
export function teacherRoleLabel(role) {
  return role === "admin" || role === "superadmin" ? "관리자" : "강사";
}

/** 선택 영역 배지: 활동중 | 비활동 */
export function teacherActivityBadgeLabel(teacher) {
  return teacherActivityStatus(teacher) === "활동중" ? "활동중" : "비활동";
}

export function formatProfileDate(value) {
  const raw = String(value || "").slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return "";
  return `${y}.${m}.${d}`;
}

export function activityStatusPatch(status, teacher, todayYmd) {
  if (status === "계약종료") {
    return {
      active: false,
      resigned_at: teacher?.resigned_at
        ? String(teacher.resigned_at).slice(0, 10)
        : todayYmd,
    };
  }
  if (status === "휴직중") {
    return { active: false, resigned_at: null };
  }
  return { active: true, resigned_at: null };
}

export function canBrowseTeacherProfiles(me) {
  return isScheduleAdmin(me);
}

export function canViewTeacherProfile(me, teacherId) {
  if (!me?.id) return false;
  if (isGearOnlyAccess(me)) return false;
  if (me.id === teacherId) return true;
  return isScheduleAdmin(me);
}

export function canEditTeacherProfile(me, teacherId) {
  if (!me?.id || !teacherId) return false;
  if (isGearOnlyAccess(me)) return false;
  if (isSuperAdmin(me)) return true;
  return me.id === teacherId;
}

export function canEditTeacherActivityStatus(me) {
  return isSuperAdmin(me);
}

export function canAccessTeacherHr(me, teacherId) {
  if (!me?.id || !teacherId) return false;
  if (isGearOnlyAccess(me)) return false;
  if (me.id === teacherId) return true;
  return isSuperAdmin(me);
}

/** 정산정보 전체보기: teacher는 본인만, superadmin은 전원. 일반 admin은 불가. */
export function canRevealTeacherSettlement(me, teacherId) {
  if (!me?.id || !teacherId) return false;
  if (isGearOnlyAccess(me)) return false;
  if (isSuperAdmin(me)) return true;
  if (me.role === "admin") return false;
  return me.id === teacherId;
}

export function canUploadTeacherContract(me) {
  return Boolean(SUPER_ADMIN_ID && me?.id && me.id === SUPER_ADMIN_ID);
}

export function canViewTeacherContract(me, teacherId) {
  if (isGearOnlyAccess(me)) return false;
  return Boolean(me?.id && teacherId && (me.id === teacherId || canUploadTeacherContract(me)));
}

export function canViewTeacherHrStatusList(me) {
  return isScheduleAdmin(me);
}
