-- 본인이 수업하는 원의 이름과 회당 단가만 조회.
-- 계약, 매출, 다른 선생님 정보는 반환하지 않는다.

CREATE OR REPLACE FUNCTION public.get_my_teaching_institutions()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT i.id, i.name
  FROM public.institution_weekly_schedule w
  JOIN public.institutions i ON i.id = w.institution_id
  WHERE w.teacher_id = auth.uid()
  ORDER BY i.name;
$$;

CREATE OR REPLACE FUNCTION public.get_my_teaching_session_rates()
RETURNS TABLE (
  institution_id uuid,
  session_type text,
  rate_per_session numeric,
  effective_from date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.institution_id, r.session_type, r.rate_per_session, r.effective_from
  FROM public.institution_session_rates r
  WHERE EXISTS (
    SELECT 1
    FROM public.institution_weekly_schedule w
    WHERE w.institution_id = r.institution_id
      AND w.teacher_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_teaching_institutions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teaching_session_rates() TO authenticated;

NOTIFY pgrst, 'reload schema';
