-- 안소연 선생님 엘란어학원 방과후 100분 → 80분 (15:00~16:40 → 15:00~16:20)
-- 월·금 동일 슬롯 + 2026-05~06 payroll_entries 재정렬

-- 1) 주간 스케줄 종료시간 수정
UPDATE public.institution_weekly_schedule
SET end_time = '16:20:00'
WHERE id IN (
  '7ee70007-2f76-4ce0-aafa-2a06b32aa6f4',  -- 월 방과후
  '40e7e131-5cf5-48e7-80cb-a5462fe896d3'   -- 금 방과후
)
AND teacher_id = (SELECT id FROM public.teachers WHERE name = '안소연' LIMIT 1);

-- 2) 확정 payroll_entries 100분 → 80분
UPDATE public.payroll_entries pe
SET minutes = 80, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '안소연' LIMIT 1) t
WHERE pe.teacher_id = t.teacher_id
  AND pe.class_date >= '2026-05-01'
  AND pe.class_date < '2026-07-01'
  AND pe.schedule_slot_id IN (
    '7ee70007-2f76-4ce0-aafa-2a06b32aa6f4',
    '40e7e131-5cf5-48e7-80cb-a5462fe896d3'
  )
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 100;
