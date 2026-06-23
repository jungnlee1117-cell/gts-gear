-- 안소연 선생님 엘란어학원 금요일 1교시(정규) 슬롯 추가
-- 9:40~10:10 (30분)

INSERT INTO public.institution_weekly_schedule (
  institution_id,
  teacher_id,
  day_of_week,
  class_type,
  start_time,
  end_time,
  label,
  sort_order
)
SELECT
  i.id,
  t.id,
  5,
  '정규',
  '09:40:00',
  '10:10:00',
  '1교시(정규)',
  12
FROM public.institutions i
CROSS JOIN public.teachers t
WHERE i.name = '엘란어학원'
  AND t.name = '안소연'
  AND NOT EXISTS (
    SELECT 1 FROM public.institution_weekly_schedule s
    WHERE s.teacher_id = t.id
      AND s.institution_id = i.id
      AND s.day_of_week = 5
      AND s.start_time = '09:40:00'
      AND s.end_time = '10:10:00'
  );
