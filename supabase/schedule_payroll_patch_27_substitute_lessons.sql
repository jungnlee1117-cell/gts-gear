-- 대체수업 관리 (슈퍼관리자 등록 · 급여/알림 연동)
-- schedule_payroll_patch_26_change_reason.sql 실행 후 적용
--
-- is_schedule_superadmin() 정의: schedule_payroll_patch_16_manager_scope_rls.sql
-- patch 16 미적용 DB에서도 실행되도록 아래에서 함수를 보장합니다.

CREATE OR REPLACE FUNCTION public.is_schedule_superadmin()
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

CREATE TABLE IF NOT EXISTS public.substitute_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  substitute_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  substitute_temp_teacher_id uuid REFERENCES public.temp_teachers(id) ON DELETE SET NULL,
  lesson_date date NOT NULL,
  time_slot text NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  schedule_slot_id uuid REFERENCES public.institution_weekly_schedule(id) ON DELETE SET NULL,
  pay_type text,
  scheduled_minutes integer NOT NULL DEFAULT 0 CHECK (scheduled_minutes >= 0),
  reason text,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'cancelled')),
  substitute_pay_amount numeric(12, 0) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT substitute_lessons_one_assignee CHECK (
    (
      substitute_teacher_id IS NOT NULL
      AND substitute_temp_teacher_id IS NULL
    )
    OR (
      substitute_teacher_id IS NULL
      AND substitute_temp_teacher_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_substitute_lessons_date
  ON public.substitute_lessons (lesson_date DESC);

CREATE INDEX IF NOT EXISTS idx_substitute_lessons_original
  ON public.substitute_lessons (original_teacher_id, lesson_date)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_substitute_lessons_substitute
  ON public.substitute_lessons (substitute_teacher_id, lesson_date)
  WHERE status = 'completed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_substitute_lessons_slot_unique
  ON public.substitute_lessons (original_teacher_id, lesson_date, schedule_slot_id)
  WHERE status = 'completed' AND schedule_slot_id IS NOT NULL;

COMMENT ON TABLE public.substitute_lessons IS
  '슈퍼관리자 등록 대체수업 — 원래 선생님 휴강, 대체 선생님(기존/임시) 급여 연동';

ALTER TABLE public.substitute_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "substitute_lessons_superadmin_all" ON public.substitute_lessons;
CREATE POLICY "substitute_lessons_superadmin_all" ON public.substitute_lessons
  FOR ALL TO authenticated
  USING (public.is_schedule_superadmin())
  WITH CHECK (public.is_schedule_superadmin());

DROP POLICY IF EXISTS "substitute_lessons_teacher_read" ON public.substitute_lessons;
CREATE POLICY "substitute_lessons_teacher_read" ON public.substitute_lessons
  FOR SELECT TO authenticated
  USING (
    original_teacher_id = auth.uid()
    OR substitute_teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "substitute_lessons_admin_read" ON public.substitute_lessons;
CREATE POLICY "substitute_lessons_admin_read" ON public.substitute_lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );
