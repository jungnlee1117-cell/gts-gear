-- 관리자 겸 강사: 원 회당 단가 × 배분율
-- 적용 시작 2026-09-01. 7·8월 급여는 이 단가를 타지 않는다.
-- BEK 정규 회당 90,000원만 추가한다. 다른 원 단가는 바꾸지 않는다.

ALTER TABLE public.teacher_pay_rates
  ADD COLUMN IF NOT EXISTS share_ratio numeric(5, 4);

ALTER TABLE public.teacher_pay_rates
  DROP CONSTRAINT IF EXISTS teacher_pay_rates_rate_unit_check;

ALTER TABLE public.teacher_pay_rates
  ADD CONSTRAINT teacher_pay_rates_rate_unit_check
  CHECK (rate_unit IN ('minute', 'session', 'revenue_share'));

ALTER TABLE public.teacher_pay_rates
  DROP CONSTRAINT IF EXISTS teacher_pay_rates_share_ratio_check;

ALTER TABLE public.teacher_pay_rates
  ADD CONSTRAINT teacher_pay_rates_share_ratio_check
  CHECK (share_ratio IS NULL OR (share_ratio > 0 AND share_ratio <= 1));

COMMENT ON COLUMN public.teacher_pay_rates.share_ratio IS
  'rate_unit=revenue_share 일 때 원 회당 단가에 곱하는 배분율. 0.9 = 90%';

INSERT INTO public.institution_session_rates (
  institution_id, session_type, rate_per_session, effective_from
)
SELECT
  'a8ed2c21-965c-4eca-857d-f235a502f57a',
  '정규',
  90000,
  '2026-09-01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.institution_session_rates
  WHERE institution_id = 'a8ed2c21-965c-4eca-857d-f235a502f57a'
    AND session_type = '정규'
    AND effective_from = '2026-09-01'
);

INSERT INTO public.teacher_pay_rates (
  teacher_id, pay_type, rate_per_minute, effective_from,
  institution_id, rate_unit, rate_per_session, share_ratio
)
SELECT
  seed.teacher_id,
  seed.pay_type,
  0,
  '2026-09-01',
  NULL,
  'revenue_share',
  NULL,
  0.9
FROM (
  VALUES
    ('ec1f7fa2-a838-45f2-b72a-e2e7ef5d54c7'::uuid, '정규'),
    ('ec1f7fa2-a838-45f2-b72a-e2e7ef5d54c7'::uuid, '방과후'),
    ('df8048a8-8691-4cf5-9cbd-4fca29911090'::uuid, '정규'),
    ('df8048a8-8691-4cf5-9cbd-4fca29911090'::uuid, '방과후')
) AS seed(teacher_id, pay_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.teacher_pay_rates r
  WHERE r.teacher_id = seed.teacher_id
    AND r.pay_type = seed.pay_type
    AND r.institution_id IS NULL
    AND r.effective_from = '2026-09-01'
    AND r.rate_unit = 'revenue_share'
);

NOTIFY pgrst, 'reload schema';
