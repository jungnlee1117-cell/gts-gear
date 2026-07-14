-- teacher_pay_rates: 기관별 단가 (institution_id)
-- 이미 컬럼이 있으면 있어도 안전하게 적용됩니다.
-- Supabase SQL Editor에서 실행

ALTER TABLE public.teacher_pay_rates
  ADD COLUMN IF NOT EXISTS institution_id uuid
    REFERENCES public.institutions(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.teacher_pay_rates.institution_id IS
  'NULL = 전체 기관 기본 단가. 값이 있으면 해당 기관 수업에만 적용 (기관별 > 기본 우선)';

CREATE INDEX IF NOT EXISTS idx_teacher_pay_rates_institution
  ON public.teacher_pay_rates (teacher_id, pay_type, institution_id, effective_from DESC);

-- 현재 유효 단가: 선생님 × 유형 × 기관(NULL 포함) 별 최신 1건
CREATE OR REPLACE VIEW public.current_teacher_pay_rates
WITH (security_invoker = true) AS
SELECT DISTINCT ON (teacher_id, pay_type, institution_id)
  id,
  teacher_id,
  pay_type,
  rate_per_minute,
  effective_from,
  institution_id,
  created_at
FROM public.teacher_pay_rates
WHERE effective_from <= CURRENT_DATE
ORDER BY teacher_id, pay_type, institution_id NULLS FIRST, effective_from DESC;

GRANT SELECT ON public.current_teacher_pay_rates TO authenticated;

-- 특정 날짜 기준 유효 단가
DROP FUNCTION IF EXISTS public.get_teacher_pay_rates_as_of(date);
CREATE OR REPLACE FUNCTION public.get_teacher_pay_rates_as_of(p_as_of date)
RETURNS TABLE (
  teacher_id uuid,
  pay_type text,
  rate_per_minute numeric,
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
    tpr.effective_from,
    tpr.institution_id
  FROM public.teacher_pay_rates tpr
  WHERE tpr.effective_from <= p_as_of
  ORDER BY tpr.teacher_id, tpr.pay_type, tpr.institution_id NULLS FIRST, tpr.effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_pay_rates_as_of(date) TO authenticated;

-- 김종현: 어린이집 기관 방과후 1,000원/분
INSERT INTO public.teacher_pay_rates (
  teacher_id,
  pay_type,
  rate_per_minute,
  effective_from,
  institution_id
)
SELECT
  t.id,
  '방과후',
  1000,
  CURRENT_DATE,
  i.id
FROM public.teachers t
CROSS JOIN public.institutions i
WHERE t.name = '김종현'
  AND i.name ILIKE '%어린이집%'
  AND COALESCE(i.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.teacher_pay_rates r
    WHERE r.teacher_id = t.id
      AND r.pay_type = '방과후'
      AND r.institution_id = i.id
      AND ROUND(r.rate_per_minute::numeric, 2) = 1000
      AND r.effective_from = CURRENT_DATE
  );
