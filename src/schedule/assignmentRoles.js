/** 배정 role 구분 — manager: 담당자, teacher: 수업 선생님 */
export const ASSIGNMENT_ROLE_MANAGER = "manager";
export const ASSIGNMENT_ROLE_TEACHER = "teacher";

export function assignmentRole(row) {
  const r = row?.role;
  if (r === ASSIGNMENT_ROLE_MANAGER) return ASSIGNMENT_ROLE_MANAGER;
  return ASSIGNMENT_ROLE_TEACHER;
}

export function isClassTeacherAssignment(row) {
  return assignmentRole(row) === ASSIGNMENT_ROLE_TEACHER;
}

export function isManagerAssignment(row) {
  return assignmentRole(row) === ASSIGNMENT_ROLE_MANAGER;
}

export function filterClassTeacherAssignments(assignments = []) {
  return (assignments || []).filter(isClassTeacherAssignment);
}

export function filterManagerAssignments(assignments = []) {
  return (assignments || []).filter(isManagerAssignment);
}
