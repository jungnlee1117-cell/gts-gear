function duplicateKey(entry) {
  return [
    entry?.teacher_id ?? "",
    entry?.substitute_teacher_id ?? "",
    entry?.institution_id ?? "",
    entry?.class_date ?? "",
    entry?.pay_type ?? "",
    Number(entry?.minutes) || 0,
    entry?.entry_status ?? "",
  ].join("|");
}

/**
 * 과거 급여 입력 중 같은 수업이 `스케줄 연결 행`과 `연결 없는 행`으로
 * 동시에 저장된 경우, 연결 없는 복제 행만 집계에서 제외한다.
 * 메모가 있거나 직접 수정된 행은 실제 추가 수업일 수 있으므로 유지한다.
 */
export function withoutLegacyPayrollDuplicates(entries) {
  const rows = entries || [];
  const scheduledKeys = new Set(
    rows.filter((entry) => entry?.schedule_slot_id).map(duplicateKey),
  );

  return rows.filter((entry) => {
    if (entry?.schedule_slot_id || entry?.home_visit_pattern_id) return true;
    if (entry?.note) return true;
    if (entry?.entry_status !== "as_scheduled" && entry?.entry_status !== "skipped") return true;
    return !scheduledKeys.has(duplicateKey(entry));
  });
}
