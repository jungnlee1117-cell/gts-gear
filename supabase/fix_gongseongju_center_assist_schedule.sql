-- 공성주 Play by GTS 삼성 센터 보조 수업 (센터보조)
-- label로 pay_type 매핑 (resolveInstitutionSlotPayType)

-- 배정: 센터보조
INSERT INTO public.institution_teacher_assignments (institution_id, teacher_id, pay_types, is_active)
SELECT
  i.id,
  t.id,
  ARRAY['센터보조']::text[],
  true
FROM public.institutions i, public.teachers t
WHERE i.name = 'Play by GTS 삼성 센터'
  AND t.name = '공성주'
ON CONFLICT (institution_id, teacher_id) DO UPDATE
SET pay_types = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      institution_teacher_assignments.pay_types || EXCLUDED.pay_types
    )
  )
),
is_active = true;

-- 월요일 3타임, 화요일 2타임
INSERT INTO public.institution_weekly_schedule (
  institution_id, teacher_id, day_of_week, class_type, start_time, end_time, label
)
SELECT
  i.id,
  t.id,
  s.day_of_week,
  '방과후',
  s.start_time::time,
  s.end_time::time,
  s.label
FROM public.institutions i
CROSS JOIN public.teachers t
CROSS JOIN (
  VALUES
    (1, '15:30:00', '16:30:00', '센터보조 1타임'),
    (1, '16:30:00', '17:30:00', '센터보조 2타임'),
    (1, '17:30:00', '18:30:00', '센터보조 3타임'),
    (2, '15:30:00', '16:30:00', '센터보조 1타임'),
    (2, '16:30:00', '17:30:00', '센터보조 2타임')
) AS s(day_of_week, start_time, end_time, label)
WHERE i.name = 'Play by GTS 삼성 센터'
  AND t.name = '공성주'
  AND NOT EXISTS (
    SELECT 1 FROM public.institution_weekly_schedule w
    WHERE w.institution_id = i.id
      AND w.teacher_id = t.id
      AND w.day_of_week = s.day_of_week
      AND w.start_time = s.start_time::time
      AND w.end_time = s.end_time::time
  );
