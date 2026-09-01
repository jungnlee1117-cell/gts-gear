-- 관리자도 본인 월간 계획안을 작성할 수 있도록 권한을 확장합니다.
-- 기존 계획안/사진은 작성자(owner_id) 기준으로 계속 분리됩니다.

CREATE OR REPLACE FUNCTION public.can_write_own_monthly_plan()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.role IN ('teacher', 'admin', 'superadmin')
      AND COALESCE(t.active, true) = true
      AND t.resigned_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_write_own_monthly_plan() TO authenticated;
