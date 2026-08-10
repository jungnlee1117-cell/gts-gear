/** 입사·퇴사 기준 월별 선생님 표시 */

/** YYYY-MM-DD | YYYY-MM | Date-ish → "YYYY-MM" */
export function toYearMonth(value) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  return null;
}

/**
 * 급여·스케줄 등 월별 목록에 선생님을 표시할지.
 * - hire_date 있으면 그 달부터 (없으면 입사 제한 없음)
 * - resigned_at 있으면 그 달까지 (다음 달부터 제외)
 * - active=false 이고 퇴직일 없으면 제외
 * - allowBeforeHire: 단가 등록 등, 입사 전에도 목록에 둘 때
 */
export function isTeacherVisibleInYearMonth(teacher, yearMonth, {
  allowBeforeHire = false,
} = {}) {
  if (!teacher) return false;
  const ym = toYearMonth(yearMonth);
  if (!ym) return false;

  const resignedYm = toYearMonth(teacher.resigned_at);
  if (teacher.active === false && !resignedYm) return false;

  if (!allowBeforeHire) {
    const hireYm = toYearMonth(teacher.hire_date);
    if (hireYm && ym < hireYm) return false;
  }

  if (resignedYm && ym > resignedYm) return false;
  return true;
}

export function filterTeachersVisibleInYearMonth(teachers, yearMonth, options) {
  return (teachers || []).filter((t) => isTeacherVisibleInYearMonth(t, yearMonth, options));
}
