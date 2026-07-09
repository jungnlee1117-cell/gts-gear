-- 수업 대본 만들기: 관리자 모듈 데이터 + 선생님 저장 대본
-- Supabase SQL Editor에서 실행하세요.

-- ── 관리자 모듈 데이터 (전체 선생님 공유) ──
CREATE TABLE IF NOT EXISTS public.lesson_script_admin_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_key text NOT NULL UNIQUE,
  data_type text NOT NULL DEFAULT 'collection_patch',
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_script_admin_data_key
  ON public.lesson_script_admin_data(data_key);

COMMENT ON TABLE public.lesson_script_admin_data IS '수업 대본 관리자 모듈 패치 (컬렉션별 upsert/deleteIds)';
COMMENT ON COLUMN public.lesson_script_admin_data.data_key IS '컬렉션 키 (warmupSets, gameVariants 등)';
COMMENT ON COLUMN public.lesson_script_admin_data.data_type IS 'collection_patch 등';
COMMENT ON COLUMN public.lesson_script_admin_data.data_json IS '{ upsert, deleteIds } 패치 JSON';

-- ── 선생님 저장 완성 대본 ──
CREATE TABLE IF NOT EXISTS public.lesson_script_saved_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  selected_options_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_script_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_text_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  difficulty text NOT NULL DEFAULT 'medium',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_script_saved_lessons_difficulty_check
    CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS idx_lesson_script_saved_lessons_created_by
  ON public.lesson_script_saved_lessons(created_by, updated_at DESC);

COMMENT ON TABLE public.lesson_script_saved_lessons IS '선생님이 저장한 완성 수업 대본';
COMMENT ON COLUMN public.lesson_script_saved_lessons.selected_options_json IS 'warmupSetId, gearId, gameId, levelId 등';
COMMENT ON COLUMN public.lesson_script_saved_lessons.final_script_json IS 'fullText, sections';
COMMENT ON COLUMN public.lesson_script_saved_lessons.custom_text_json IS 'customTexts, safetyOverrides';

-- ── 권한 헬퍼 ──
CREATE OR REPLACE FUNCTION public.is_lesson_script_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lesson_script_superadmin()
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

-- ── RLS: lesson_script_admin_data ──
ALTER TABLE public.lesson_script_admin_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_script_admin_data_select" ON public.lesson_script_admin_data;
CREATE POLICY "lesson_script_admin_data_select" ON public.lesson_script_admin_data
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lesson_script_admin_data_insert" ON public.lesson_script_admin_data;
CREATE POLICY "lesson_script_admin_data_insert" ON public.lesson_script_admin_data
  FOR INSERT TO authenticated
  WITH CHECK (public.is_lesson_script_admin());

DROP POLICY IF EXISTS "lesson_script_admin_data_update" ON public.lesson_script_admin_data;
CREATE POLICY "lesson_script_admin_data_update" ON public.lesson_script_admin_data
  FOR UPDATE TO authenticated
  USING (public.is_lesson_script_admin())
  WITH CHECK (public.is_lesson_script_admin());

DROP POLICY IF EXISTS "lesson_script_admin_data_delete" ON public.lesson_script_admin_data;
CREATE POLICY "lesson_script_admin_data_delete" ON public.lesson_script_admin_data
  FOR DELETE TO authenticated
  USING (public.is_lesson_script_admin());

-- ── RLS: lesson_script_saved_lessons ──
ALTER TABLE public.lesson_script_saved_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_script_saved_lessons_select" ON public.lesson_script_saved_lessons;
CREATE POLICY "lesson_script_saved_lessons_select" ON public.lesson_script_saved_lessons
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR public.is_lesson_script_superadmin()
  );

DROP POLICY IF EXISTS "lesson_script_saved_lessons_insert" ON public.lesson_script_saved_lessons;
CREATE POLICY "lesson_script_saved_lessons_insert" ON public.lesson_script_saved_lessons
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "lesson_script_saved_lessons_update" ON public.lesson_script_saved_lessons;
CREATE POLICY "lesson_script_saved_lessons_update" ON public.lesson_script_saved_lessons
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR public.is_lesson_script_superadmin()
  )
  WITH CHECK (
    created_by = auth.uid() OR public.is_lesson_script_superadmin()
  );

DROP POLICY IF EXISTS "lesson_script_saved_lessons_delete" ON public.lesson_script_saved_lessons;
CREATE POLICY "lesson_script_saved_lessons_delete" ON public.lesson_script_saved_lessons
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR public.is_lesson_script_superadmin()
  );
