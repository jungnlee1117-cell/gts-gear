/**
 * teachers.role — 스케줄 관리 권한 (teacher | admin | superadmin)
 * teachers.is_item_admin — 교구 시스템 관리 권한 (대여/반납/교구 등)
 */

export const SUPER_ADMIN_ID = import.meta.env.VITE_SUPER_ADMIN_ID || "";

/** 스케줄: 원 관리 · 급여 · 정산 */
export const isScheduleAdmin = (u) =>
  u?.role === "superadmin" || u?.role === "admin";

/** 교구: 대여/반납/교구 관리 (스케줄 role=admin 과 분리 — is_item_admin 또는 슈퍼관리자) */
export const isItemAdmin = (u) =>
  u?.role === "superadmin"
  || u?.is_item_admin === true;

export const isSuperAdmin = (u) =>
  u?.role === "superadmin" || (!!SUPER_ADMIN_ID && u?.id === SUPER_ADMIN_ID);

/** 교구 앱에서 일반 강사 UI */
export const isGearTeacher = (u) =>
  u?.role === "teacher" && !isItemAdmin(u);

/** 교구 플랫폼: 대시보드 · 공지 작성/수정/삭제 */
export const isGearPlatformAdmin = isScheduleAdmin;
