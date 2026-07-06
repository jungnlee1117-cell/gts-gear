-- 일회성 수업 (선생님 월별 일정 · 급여 연동)
-- schedule_payroll_patch_27_substitute_lessons.sql 실행 후 적용

CREATE OR REPLACE FUNCTION public.is_schedule_admin()
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

CREATE TABLE IF NOT EXISTS public.oneoff_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  lesson_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  memo text,
  link_payroll boolean NOT NULL DEFAULT false,
  pay_amount numeric(12, 0),
  payroll_entry_id uuid REFERENCES public.payroll_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oneoff_lessons_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_oneoff_lessons_teacher_date
  ON public.oneoff_lessons (teacher_id, lesson_date);

CREATE INDEX IF NOT EXISTS idx_oneoff_lessons_date
  ON public.oneoff_lessons (lesson_date DESC);

COMMENT ON TABLE public.oneoff_lessons IS
  '관리자 등록 일회성 수업 — 선생님 월별 일정 파란색 표시 · 급여 연동 선택';

ALTER TABLE public.oneoff_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oneoff_lessons_admin_all" ON public.oneoff_lessons;
CREATE POLICY "oneoff_lessons_admin_all" ON public.oneoff_lessons
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "oneoff_lessons_teacher_read" ON public.oneoff_lessons;
CREATE POLICY "oneoff_lessons_teacher_read" ON public.oneoff_lessons
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
