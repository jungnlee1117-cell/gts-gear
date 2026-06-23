-- 김종현 교통비지원 100,000원 (2026-03 ~ 2027-02)
-- 이미 해당 월에 동일 teacher_id + year_month 가 있으면 건너뜀

INSERT INTO public.additional_payments (teacher_id, year_month, amount, reason, created_by)
SELECT
  t.id,
  ym.month_date,
  100000,
  '교통비지원',
  admin.id
FROM public.teachers t
CROSS JOIN (
  VALUES
    ('2026-03-01'::date),
    ('2026-04-01'::date),
    ('2026-05-01'::date),
    ('2026-06-01'::date),
    ('2026-07-01'::date),
    ('2026-08-01'::date),
    ('2026-09-01'::date),
    ('2026-10-01'::date),
    ('2026-11-01'::date),
    ('2026-12-01'::date),
    ('2027-01-01'::date),
    ('2027-02-01'::date)
) AS ym(month_date)
CROSS JOIN LATERAL (
  SELECT id FROM public.teachers WHERE role = 'superadmin' ORDER BY created_at LIMIT 1
) admin
WHERE t.name = '김종현'
  AND NOT EXISTS (
    SELECT 1 FROM public.additional_payments ap
    WHERE ap.teacher_id = t.id AND ap.year_month = ym.month_date
  );
