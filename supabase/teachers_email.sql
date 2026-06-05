-- teachers 이메일 표시: teachers.email 없으면 auth.users.email 사용
-- Supabase SQL Editor에서 실행

ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.get_teachers_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  role text,
  active boolean,
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
    t.created_at
  FROM public.teachers t
  LEFT JOIN auth.users u ON u.id = t.id
  ORDER BY t.created_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_with_email() TO authenticated;
