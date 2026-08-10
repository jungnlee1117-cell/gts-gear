-- teachers: 입사일(hire_date) 컬럼 + 목록 RPC 반영
-- Supabase SQL Editor 또는 CLI에서 실행

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS hire_date date;

COMMENT ON COLUMN public.teachers.hire_date IS
  '입사일. 급여·스케줄 목록은 이 날짜가 속한 달부터 표시. NULL이면 입사 제한 없음';

CREATE INDEX IF NOT EXISTS idx_teachers_hire_date
  ON public.teachers (hire_date)
  WHERE hire_date IS NOT NULL;

-- OUT 파라미터 변경이므로 기존 함수 먼저 제거
DROP FUNCTION IF EXISTS public.get_teachers_with_email();

CREATE FUNCTION public.get_teachers_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  role text,
  active boolean,
  is_item_admin boolean,
  hire_date date,
  resigned_at date,
  resignation_reason text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    t.id,
    t.name,
    t.phone,
    COALESCE(NULLIF(TRIM(t.email), ''), u.email::text) AS email,
    t.role,
    t.active,
    COALESCE(t.is_item_admin, false) AS is_item_admin,
    t.hire_date,
    t.resigned_at,
    t.resignation_reason,
    t.created_at
  FROM public.teachers t
  LEFT JOIN auth.users u ON u.id = t.id
  ORDER BY t.created_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_with_email() TO authenticated;
