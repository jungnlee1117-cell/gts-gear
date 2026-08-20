-- teachers: 마이페이지 기본정보 컬럼
-- 기존 데이터/구조는 유지하고 컬럼만 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS english_name text;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS contract_type text;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS emergency_contact text;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS qualifications text;

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_contract_type_check;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_contract_type_check
  CHECK (
    contract_type IS NULL
    OR contract_type = ANY (ARRAY['정규직'::text, '위탁계약'::text, '파트타임'::text])
  );

COMMENT ON COLUMN public.teachers.english_name IS '영문명';
COMMENT ON COLUMN public.teachers.contract_type IS '계약 형태: 정규직 | 위탁계약 | 파트타임';
COMMENT ON COLUMN public.teachers.emergency_contact IS '비상연락처';
COMMENT ON COLUMN public.teachers.qualifications IS '자격증 / 경력 (자유 텍스트)';

-- 본인 프로필 수정 허용 (관리자 정책과 OR로 함께 동작)
DROP POLICY IF EXISTS "teachers_update_own_profile" ON public.teachers;
CREATE POLICY "teachers_update_own_profile" ON public.teachers
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 목록 RPC에 신규 컬럼 반영
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
  english_name text,
  contract_type text,
  emergency_contact text,
  qualifications text,
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
    t.english_name,
    t.contract_type,
    t.emergency_contact,
    t.qualifications,
    t.created_at
  FROM public.teachers t
  LEFT JOIN auth.users u ON u.id = t.id
  ORDER BY t.created_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_with_email() TO authenticated;
