-- 월간 계획안 자료실 저장용 공용 인프라.
-- 개별 계획안 빌더를 제거한 뒤에도 유지해야 하는 공용 객체만 정의합니다.

CREATE OR REPLACE FUNCTION public.can_manage_lesson_plans()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.role IN ('teacher','admin','superadmin')
      AND COALESCE(t.active, true) = true
      AND t.resigned_at IS NULL
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.is_lesson_plan_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = auth.uid()
      AND t.role IN ('admin','superadmin')
      AND COALESCE(t.active, true) = true
      AND t.resigned_at IS NULL
  );
END;
$fn$;

CREATE TABLE IF NOT EXISTS public.resource_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL REFERENCES public.pe_categories(id),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, teacher_id)
);

ALTER TABLE public.resource_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_folders_select" ON public.resource_folders;
CREATE POLICY "resource_folders_select"
  ON public.resource_folders FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_lesson_plan_admin());

DROP POLICY IF EXISTS "resource_folders_admin_write" ON public.resource_folders;
CREATE POLICY "resource_folders_admin_write"
  ON public.resource_folders FOR ALL TO authenticated
  USING (public.is_lesson_plan_admin())
  WITH CHECK (public.is_lesson_plan_admin());

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.resource_folders(id);

CREATE OR REPLACE FUNCTION public.ensure_lesson_plan_teacher_folder(p_teacher_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_folder_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF NOT public.can_manage_lesson_plans() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  SELECT id INTO v_folder_id
  FROM public.resource_folders
  WHERE category_id = 'lesson-plans'
    AND teacher_id = auth.uid();

  IF v_folder_id IS NULL THEN
    INSERT INTO public.resource_folders (category_id, teacher_id, name)
    VALUES ('lesson-plans', auth.uid(), p_teacher_name)
    RETURNING id INTO v_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.ensure_lesson_plan_teacher_folder(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_lesson_plan_teacher_folder(text) TO authenticated;

DO $res$
BEGIN
  IF to_regclass('public.resources') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "resources_insert_admin" ON public.resources';
  EXECUTE 'DROP POLICY IF EXISTS "resources_insert" ON public.resources';
  EXECUTE $sql$
    CREATE POLICY "resources_insert" ON public.resources
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.teachers t
          WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
        )
        OR (
          author_id = auth.uid()
          AND category_id = 'lesson-plans'
          AND public.can_manage_lesson_plans()
        )
      )
  $sql$;
END
$res$;

DROP POLICY IF EXISTS "pe_resources_lesson_plans_insert" ON storage.objects;
CREATE POLICY "pe_resources_lesson_plans_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pe-resources'
    AND (storage.foldername(name))[1] = 'lesson-plans'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_manage_lesson_plans()
  );

DROP POLICY IF EXISTS "pe_resources_lesson_plans_update" ON storage.objects;
CREATE POLICY "pe_resources_lesson_plans_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pe-resources'
    AND (storage.foldername(name))[1] = 'lesson-plans'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_manage_lesson_plans()
  )
  WITH CHECK (
    bucket_id = 'pe-resources'
    AND (storage.foldername(name))[1] = 'lesson-plans'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_manage_lesson_plans()
  );

DROP POLICY IF EXISTS "pe_resources_lesson_plans_select" ON storage.objects;
CREATE POLICY "pe_resources_lesson_plans_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pe-resources'
    AND (storage.foldername(name))[1] = 'lesson-plans'
  );
