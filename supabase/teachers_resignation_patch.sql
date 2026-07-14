-- teachers: 퇴직 처리 컬럼
-- active 는 기존 컬럼일 수 있음 — IF NOT EXISTS 로 안전하게 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS resigned_at date;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS resignation_reason text;

COMMENT ON COLUMN public.teachers.active IS
  '계정 활성 여부. 퇴직 처리 시 false. 퇴직일 당일까지는 앱이 resigned_at 기준으로 로그인 허용';
COMMENT ON COLUMN public.teachers.resigned_at IS
  '퇴직일. 이 날짜까지 정상 사용, 다음 날부터 로그인 차단';
COMMENT ON COLUMN public.teachers.resignation_reason IS
  '퇴직 사유';

CREATE INDEX IF NOT EXISTS idx_teachers_resigned_at
  ON public.teachers (resigned_at)
  WHERE resigned_at IS NOT NULL;

-- 목록 RPC에 퇴직·교구관리자 컬럼 포함
CREATE OR REPLACE FUNCTION public.get_teachers_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  role text,
  active boolean,
  is_item_admin boolean,
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
    t.resigned_at,
    t.resignation_reason,
    t.created_at
  FROM public.teachers t
  LEFT JOIN auth.users u ON u.id = t.id
  ORDER BY t.created_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_with_email() TO authenticated;
