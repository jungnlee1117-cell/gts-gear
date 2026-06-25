-- 윤한경 선생님 · 프랜시스파커 · 화요일 방과후
-- 14:50~15:20 (30분), 15:25~16:10 (45분)

-- 1) 1교시: 14:50~15:20
UPDATE public.institution_weekly_schedule s
SET start_time = '14:50:00', end_time = '15:20:00'
FROM public.teachers t, public.institutions i
WHERE s.teacher_id = t.id
  AND t.name = '윤한경'
  AND s.institution_id = i.id
  AND i.name LIKE '%프랜시스%'
  AND s.day_of_week = 2
  AND s.class_type = '방과후'
  AND s.start_time < '15:25:00';

-- 2) 2교시: 15:25~16:10
UPDATE public.institution_weekly_schedule s
SET start_time = '15:25:00', end_time = '16:10:00'
FROM public.teachers t, public.institutions i
WHERE s.teacher_id = t.id
  AND t.name = '윤한경'
  AND s.institution_id = i.id
  AND i.name LIKE '%프랜시스%'
  AND s.day_of_week = 2
  AND s.class_type = '방과후'
  AND s.start_time >= '15:20:00';

-- 3) 확정 payroll_entries — 2교시 50분 → 45분
UPDATE public.payroll_entries pe
SET minutes = 45, updated_at = now()
FROM public.teachers t,
     public.institution_weekly_schedule s,
     public.institutions i
WHERE pe.teacher_id = t.id
  AND t.name = '윤한경'
  AND pe.schedule_slot_id = s.id
  AND s.institution_id = i.id
  AND i.name LIKE '%프랜시스%'
  AND s.day_of_week = 2
  AND s.class_type = '방과후'
  AND s.start_time = '15:25:00'
  AND pe.entry_status = 'as_scheduled'
  AND pe.minutes = 50;
