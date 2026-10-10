-- 강사 단가: 분당(시간당 입력 포함) 외에 회당 고정 금액
-- Supabase SQL Editor 또는 supabase db query 로 실행

ALTER TABLE public.teacher_pay_rates
  ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT 'minute';

ALTER TABLE public.teacher_pay_rates
  DROP CONSTRAINT IF EXISTS teacher_pay_rates_rate_unit_check;

ALTER TABLE public.teacher_pay_rates
  ADD CONSTRAINT teacher_pay_rates_rate_unit_check
  CHECK (rate_unit IN ('minute', 'session'));

ALTER TABLE public.teacher_pay_rates
  ADD COLUMN IF NOT EXISTS rate_per_session numeric(12, 0);

COMMENT ON COLUMN public.teacher_pay_rates.rate_unit IS
  'minute = rate_per_minute 로 분 단위 계산. session = rate_per_session 을 수업 1회당 고정 지급';

COMMENT ON COLUMN public.teacher_pay_rates.rate_per_session IS
  'rate_unit=session 일 때 수업 1회 금액(원). minute 이면 NULL';

DROP VIEW IF EXISTS public.current_teacher_pay_rates;
CREATE VIEW public.current_teacher_pay_rates
WITH (security_invoker = true) AS
SELECT DISTINCT ON (teacher_id, pay_type, institution_id)
  id,
  teacher_id,
  pay_type,
  rate_per_minute,
  effective_from,
  institution_id,
  created_at,
  rate_unit,
  rate_per_session
FROM public.teacher_pay_rates
WHERE effective_from <= CURRENT_DATE
ORDER BY teacher_id, pay_type, institution_id NULLS FIRST, effective_from DESC;

GRANT SELECT ON public.current_teacher_pay_rates TO authenticated;

DROP FUNCTION IF EXISTS public.get_teacher_pay_rates_as_of(date);
CREATE OR REPLACE FUNCTION public.get_teacher_pay_rates_as_of(p_as_of date)
RETURNS TABLE (
  teacher_id uuid,
  pay_type text,
  rate_per_minute numeric,
  rate_unit text,
  rate_per_session numeric,
  effective_from date,
  institution_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (tpr.teacher_id, tpr.pay_type, tpr.institution_id)
    tpr.teacher_id,
    tpr.pay_type,
    tpr.rate_per_minute,
    tpr.rate_unit,
    tpr.rate_per_session,
    tpr.effective_from,
    tpr.institution_id
  FROM public.teacher_pay_rates tpr
  WHERE tpr.effective_from <= p_as_of
  ORDER BY tpr.teacher_id, tpr.pay_type, tpr.institution_id NULLS FIRST, tpr.effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_pay_rates_as_of(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
