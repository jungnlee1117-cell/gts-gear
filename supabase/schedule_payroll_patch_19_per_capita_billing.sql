-- 인당과금(per_capita) billing_type 추가
-- institution_session_rates(session_type='인당') + institution_monthly_session_counts 로 인원수·단가 관리

ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_billing_type_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_billing_type_check
  CHECK (billing_type IN ('monthly_fixed', 'per_session', 'per_capita', 'manual'));

-- 4개 어린이집 → per_capita + 인당 단가 + 2026-06 인원수
WITH targets AS (
  SELECT * FROM (VALUES
    ('텐즈아이어린이집', 25300, 20),
    ('한신어린이집', 17500, 34),
    ('아띠어린이집', 22000, 10),
    ('두리어린이집', 19000, 23)
  ) AS t(name, rate, headcount)
),
inst AS (
  SELECT i.id, i.name, t.rate, t.headcount
  FROM targets t
  JOIN public.institutions i ON i.name = t.name
)
UPDATE public.institutions i
SET billing_type = 'per_capita', updated_at = now()
FROM inst
WHERE i.id = inst.id;

INSERT INTO public.institution_session_rates (
  institution_id, session_type, rate_per_session, effective_from
)
SELECT i.id, '인당', t.rate, '2025-01-01'::date
FROM (VALUES
  ('텐즈아이어린이집', 25300),
  ('한신어린이집', 17500),
  ('아띠어린이집', 22000),
  ('두리어린이집', 19000)
) AS t(name, rate)
JOIN public.institutions i ON i.name = t.name
WHERE NOT EXISTS (
  SELECT 1 FROM public.institution_session_rates r
  WHERE r.institution_id = i.id AND r.session_type = '인당'
);

INSERT INTO public.institution_monthly_session_counts (
  institution_id, year_month, session_type, session_count
)
SELECT i.id, '2026-06-01'::date, '인당', t.headcount
FROM (VALUES
  ('텐즈아이어린이집', 20),
  ('한신어린이집', 34),
  ('아띠어린이집', 10),
  ('두리어린이집', 23)
) AS t(name, headcount)
JOIN public.institutions i ON i.name = t.name
ON CONFLICT (institution_id, year_month, session_type)
DO UPDATE SET session_count = EXCLUDED.session_count, updated_at = now();
