-- 자격증 / 경력 child tables (additive)
-- teachers.qualifications 컬럼은 legacy로 유지. 기존 데이터 삭제 없음.

CREATE OR REPLACE FUNCTION public.is_teacher_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_schedule_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher_schedule_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_schedule_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.teacher_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuing_organization text,
  acquired_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  organization text NOT NULL,
  role text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_certifications_teacher_id_idx
  ON public.teacher_certifications (teacher_id, acquired_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS teacher_careers_teacher_id_idx
  ON public.teacher_careers (teacher_id, start_date DESC NULLS LAST, created_at DESC);

COMMENT ON TABLE public.teacher_certifications IS '선생님 자격증. teachers.qualifications 와 별도.';
COMMENT ON TABLE public.teacher_careers IS '선생님 경력. teachers.qualifications 와 별도.';

ALTER TABLE public.teacher_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_careers ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 또는 admin/superadmin
DROP POLICY IF EXISTS "teacher_certifications_select" ON public.teacher_certifications;
CREATE POLICY "teacher_certifications_select" ON public.teacher_certifications
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_schedule_admin());

DROP POLICY IF EXISTS "teacher_careers_select" ON public.teacher_careers;
CREATE POLICY "teacher_careers_select" ON public.teacher_careers
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_schedule_admin());

-- INSERT/UPDATE/DELETE: 본인 또는 superadmin (일반 admin은 조회만)
DROP POLICY IF EXISTS "teacher_certifications_insert" ON public.teacher_certifications;
CREATE POLICY "teacher_certifications_insert" ON public.teacher_certifications
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() OR public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_certifications_update" ON public.teacher_certifications;
CREATE POLICY "teacher_certifications_update" ON public.teacher_certifications
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_superadmin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_certifications_delete" ON public.teacher_certifications;
CREATE POLICY "teacher_certifications_delete" ON public.teacher_certifications
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_careers_insert" ON public.teacher_careers;
CREATE POLICY "teacher_careers_insert" ON public.teacher_careers
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() OR public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_careers_update" ON public.teacher_careers;
CREATE POLICY "teacher_careers_update" ON public.teacher_careers
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_superadmin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_careers_delete" ON public.teacher_careers;
CREATE POLICY "teacher_careers_delete" ON public.teacher_careers
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_teacher_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_careers TO authenticated;
