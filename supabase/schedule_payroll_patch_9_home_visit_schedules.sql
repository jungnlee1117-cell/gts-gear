-- 가정방문(방문수업) 일정
-- schedule_payroll_patch_8_additional_payments.sql 실행 후 적용

CREATE TABLE IF NOT EXISTS public.home_visit_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  location text,
  student_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_visit_schedules_teacher_date
  ON public.home_visit_schedules (teacher_id, visit_date DESC);

COMMENT ON TABLE public.home_visit_schedules IS '강사별 가정방문 수업 일정 (날짜·시간·장소·학생)';

ALTER TABLE public.home_visit_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_visit_admin_all" ON public.home_visit_schedules;
CREATE POLICY "home_visit_admin_all" ON public.home_visit_schedules
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "home_visit_own_select" ON public.home_visit_schedules;
CREATE POLICY "home_visit_own_select" ON public.home_visit_schedules
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "home_visit_own_write" ON public.home_visit_schedules;
CREATE POLICY "home_visit_own_write" ON public.home_visit_schedules
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
