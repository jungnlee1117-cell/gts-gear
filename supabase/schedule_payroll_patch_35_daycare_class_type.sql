-- 수업·단가 유형에 「어린이집」추가 + 기존 어린이집/유치원 기관 슬롯 이전

ALTER TABLE public.institution_weekly_schedule
  DROP CONSTRAINT IF EXISTS institution_weekly_schedule_class_type_check;

ALTER TABLE public.institution_weekly_schedule
  ADD CONSTRAINT institution_weekly_schedule_class_type_check
  CHECK (class_type = ANY (ARRAY['정규'::text, '방과후'::text, '어린이집'::text]));

ALTER TABLE public.teacher_pay_rates
  DROP CONSTRAINT IF EXISTS teacher_pay_rates_pay_type_check;

ALTER TABLE public.teacher_pay_rates
  ADD CONSTRAINT teacher_pay_rates_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text
  ]));

ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_pay_type_check;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text
  ]));

ALTER TABLE public.temp_teachers
  DROP CONSTRAINT IF EXISTS temp_teachers_pay_type_check;

ALTER TABLE public.temp_teachers
  ADD CONSTRAINT temp_teachers_pay_type_check
  CHECK (pay_type = ANY (ARRAY[
    '정규'::text, '방과후'::text, '어린이집'::text,
    '가정방문'::text, '센터'::text, '센터보조'::text
  ]));

-- 기존 어린이집·유치원 기관의 주간 슬롯 → class_type = 어린이집
UPDATE public.institution_weekly_schedule s
SET class_type = '어린이집'
FROM public.institutions i
WHERE s.institution_id = i.id
  AND (
    i.name LIKE '%어린이집%'
    OR i.name LIKE '%유치원%'
  )
  AND s.class_type IN ('정규', '방과후');

COMMENT ON COLUMN public.institution_weekly_schedule.class_type IS
  '정규 | 방과후 | 어린이집';
