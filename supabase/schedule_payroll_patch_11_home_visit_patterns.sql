-- 방문수업 반복 패턴 (매주 요일·시간)
-- schedule_payroll_patch_10_schedule_change_notifications.sql 실행 후 적용
-- 기존 단발 home_visit_schedules → 패턴 기반으로 전환

CREATE TABLE IF NOT EXISTS public.home_visit_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_birth_date date,
  parent_contact text,
  location text,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time,
  pattern_start_date date NOT NULL,
  pattern_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_visit_patterns_end_after_start
    CHECK (pattern_end_date IS NULL OR pattern_end_date >= pattern_start_date)
);

CREATE INDEX IF NOT EXISTS idx_home_visit_patterns_teacher
  ON public.home_visit_patterns (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_home_visit_patterns_day
  ON public.home_visit_patterns (day_of_week, status);

COMMENT ON TABLE public.home_visit_patterns IS
  '가정방문 반복 일정 패턴 — 캘린더는 매주 자동 전개';

COMMENT ON COLUMN public.home_visit_patterns.day_of_week IS '0=일 … 6=토 (JS Date.getDay()와 동일)';

ALTER TABLE public.home_visit_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_visit_patterns_admin_all" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_admin_all" ON public.home_visit_patterns
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "home_visit_patterns_own_select" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_select" ON public.home_visit_patterns
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "home_visit_patterns_own_insert" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_insert" ON public.home_visit_patterns
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "home_visit_patterns_own_update" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_update" ON public.home_visit_patterns
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "home_visit_patterns_own_delete" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_delete" ON public.home_visit_patterns
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "home_visit_patterns_own_write" ON public.home_visit_patterns;

-- 단발 일정 테이블 제거 (이미 없으면 스킵 — DROP POLICY는 테이블 없을 때 에러남)
DO $$
BEGIN
  IF to_regclass('public.home_visit_schedules') IS NOT NULL THEN
    DROP POLICY IF EXISTS "home_visit_admin_all" ON public.home_visit_schedules;
    DROP POLICY IF EXISTS "home_visit_own_select" ON public.home_visit_schedules;
    DROP POLICY IF EXISTS "home_visit_own_write" ON public.home_visit_schedules;
    DROP TABLE public.home_visit_schedules;
  END IF;
END $$;
