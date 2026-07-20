/** 할 일 담당자(audience) 옵션 — 일회성 / 반복 공통 */

export const TODO_AUDIENCE_OPTIONS = [
  { value: "assignee", label: "한 명", hint: "관리자·슈퍼관리자 1명에게 배정" },
  { value: "selected_teachers", label: "여러 명 선택", hint: "선택한 선생님마다 개별 할 일(각자 완료)" },
  { value: "all_teachers", label: "전체 선생님(개별 완료)", hint: "활성 선생님 전원에게 개별 할 일" },
  { value: "shared", label: "담당: 전체(공용 1건)", hint: "공용 1건 — 아무나 완료하면 전체가 완료" },
];

/** 멀티/전체 개별 완료 대상 선생님 풀 */
export function selectableTodoTeachers(teachers = []) {
  return (teachers || [])
    .filter((t) => t.role === "teacher" && t.active !== false && !t.resigned_at)
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}

export function isMultiAudienceType(type) {
  return type === "all_teachers" || type === "selected_teachers";
}

export function audienceTypeLabel(type, { assigneeName, selectedCount } = {}) {
  if (type === "all_teachers") return "전체 선생님(개인별)";
  if (type === "selected_teachers") {
    const n = selectedCount ?? 0;
    return n > 0 ? `선택 ${n}명(개인별)` : "선택 선생님(개인별)";
  }
  if (type === "shared") return "담당: 전체(공용)";
  if (assigneeName) return `담당: ${assigneeName}`;
  return "담당: (미지정)";
}

export function newSpawnGroupId() {
  return globalThis.crypto?.randomUUID?.() || `sg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
