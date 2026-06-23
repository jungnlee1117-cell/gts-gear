-- 스케줄/급여 후속 패치: 배정 soft delete + 현재 단가 뷰
-- schedule_payroll.sql 실행 후 Supabase SQL Editor에서 실행

ALTER TABLE public.institution_teacher_assignments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_assignments_active
  ON public.institution_teacher_assignments(institution_id)
  WHERE is_active = true;

-- 현재 유효 단가 (오늘 기준) — 호출자 권한으로 teacher_pay_rates RLS 적용
CREATE OR REPLACE VIEW public.current_teacher_pay_rates
WITH (security_invoker = true) AS
SELECT DISTINCT ON (teacher_id, pay_type)
  id,
  teacher_id,
  pay_type,
  rate_per_minute,
  effective_from,
  created_at
FROM public.teacher_pay_rates
WHERE effective_from <= CURRENT_DATE
ORDER BY teacher_id, pay_type, effective_from DESC;

-- 특정 날짜 기준 유효 단가 조회 (급여 계산용)
CREATE OR REPLACE FUNCTION public.get_teacher_pay_rates_as_of(p_as_of date)
RETURNS TABLE (
  teacher_id uuid,
  pay_type text,
  rate_per_minute numeric,
  effective_from date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (tpr.teacher_id, tpr.pay_type)
    tpr.teacher_id,
    tpr.pay_type,
    tpr.rate_per_minute,
    tpr.effective_from
  FROM public.teacher_pay_rates tpr
  WHERE tpr.effective_from <= p_as_of
  ORDER BY tpr.teacher_id, tpr.pay_type, tpr.effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_pay_rates_as_of(date) TO authenticated;

-- 뷰/함수: 관리자만 (강사 단가는 민감정보)
GRANT SELECT ON public.current_teacher_pay_rates TO authenticated;

-- security_invoker=true → teacher_pay_rates 테이블 RLS를 그대로 따름 (강사는 본인 단가만)
