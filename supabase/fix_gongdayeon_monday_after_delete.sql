-- 공다연 · 대치폴리 · 월요일 방과후 2슬롯 삭제
-- 15:00~15:40, 15:45~16:25
-- 연결된 payroll_entries도 함께 삭제

WITH target_slots AS (
  SELECT s.id
  FROM public.institution_weekly_schedule s
  JOIN public.teachers t ON t.id = s.teacher_id AND t.name = '공다연'
  JOIN public.institutions i ON i.id = s.institution_id AND i.name LIKE '%대치%'
  WHERE s.day_of_week = 1
    AND s.class_type = '방과후'
    AND s.start_time IN ('15:00:00', '15:45:00')
),
deleted_payroll AS (
  DELETE FROM public.payroll_entries pe
  USING target_slots ts
  WHERE pe.schedule_slot_id = ts.id
  RETURNING pe.id
)
DELETE FROM public.institution_weekly_schedule s
USING target_slots ts
WHERE s.id = ts.id;
