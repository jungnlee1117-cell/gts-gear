-- 안소연 엘란 금요일 1교시(9:40~10:10) payroll 백필 + 회당 과금 횟수 조정
-- 슬롯: 0c8e3e47-a08c-4e6e-aa17-4c4a4a253689

-- 1) 5월 custom → as_scheduled
UPDATE public.payroll_entries pe
SET entry_status = 'as_scheduled', minutes = 30, updated_at = now()
FROM (SELECT id AS teacher_id FROM public.teachers WHERE name = '안소연' LIMIT 1) t
WHERE pe.teacher_id = t.teacher_id
  AND pe.schedule_slot_id = '0c8e3e47-a08c-4e6e-aa17-4c4a4a253689'
  AND pe.class_date IN ('2026-05-08', '2026-05-15')
  AND pe.entry_status = 'custom'
  AND pe.minutes = 30;

-- 2) 6월 금요일 entry INSERT (4회)
INSERT INTO public.payroll_entries (
  teacher_id, institution_id, class_date, pay_type, minutes,
  entry_status, schedule_slot_id
)
SELECT
  t.id,
  i.id,
  d.class_date::date,
  '정규',
  30,
  'as_scheduled',
  '0c8e3e47-a08c-4e6e-aa17-4c4a4a253689'::uuid
FROM public.teachers t
CROSS JOIN public.institutions i
CROSS JOIN (
  VALUES ('2026-06-05'), ('2026-06-12'), ('2026-06-19'), ('2026-06-26')
) AS d(class_date)
WHERE t.name = '안소연'
  AND i.name = '엘란어학원'
  AND NOT EXISTS (
    SELECT 1 FROM public.payroll_entries pe
    WHERE pe.teacher_id = t.id
      AND pe.class_date = d.class_date::date
      AND pe.schedule_slot_id = '0c8e3e47-a08c-4e6e-aa17-4c4a4a253689'
  );

-- 3) 5월 회당 횟수 (미입력 시 payroll 확정 건수로 생성)
INSERT INTO public.institution_monthly_session_counts (
  institution_id, year_month, session_type, session_count
)
SELECT i.id, '2026-05-01'::date, '정규', 60
FROM public.institutions i
WHERE i.name = '엘란어학원'
  AND NOT EXISTS (
    SELECT 1 FROM public.institution_monthly_session_counts c
    WHERE c.institution_id = i.id AND c.year_month = '2026-05-01' AND c.session_type = '정규'
  );

INSERT INTO public.institution_monthly_session_counts (
  institution_id, year_month, session_type, session_count
)
SELECT i.id, '2026-05-01'::date, '방과후', 7
FROM public.institutions i
WHERE i.name = '엘란어학원'
  AND NOT EXISTS (
    SELECT 1 FROM public.institution_monthly_session_counts c
    WHERE c.institution_id = i.id AND c.year_month = '2026-05-01' AND c.session_type = '방과후'
  );

-- 4) 6월 정규 +4 (금요일 1교시 슬롯 추가)
UPDATE public.institution_monthly_session_counts c
SET session_count = session_count + 4, updated_at = now()
FROM public.institutions i
WHERE c.institution_id = i.id
  AND i.name = '엘란어학원'
  AND c.year_month = '2026-06-01'
  AND c.session_type = '정규';
