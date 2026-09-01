-- 같은 수업이 스케줄 연결 행과 구형 연결 없는 행으로 중복 저장된 경우 정리
-- 메모가 없고 날짜·선생님·기관·급여종류·시간·상태가 모두 같은 행만 삭제한다.

DELETE FROM public.payroll_entries legacy
WHERE legacy.schedule_slot_id IS NULL
  AND legacy.home_visit_pattern_id IS NULL
  AND legacy.note IS NULL
  AND legacy.entry_status IN ('as_scheduled', 'skipped')
  AND EXISTS (
    SELECT 1
    FROM public.payroll_entries linked
    WHERE linked.schedule_slot_id IS NOT NULL
      AND linked.teacher_id = legacy.teacher_id
      AND linked.class_date = legacy.class_date
      AND linked.institution_id IS NOT DISTINCT FROM legacy.institution_id
      AND linked.pay_type = legacy.pay_type
      AND linked.minutes = legacy.minutes
      AND linked.entry_status = legacy.entry_status
      AND linked.substitute_teacher_id IS NOT DISTINCT FROM legacy.substitute_teacher_id
  );
