-- 선생님 휴가 기간. 달력 표시와 수업 체크인 알림 제외에 함께 사용한다.

CREATE TABLE IF NOT EXISTS public.teacher_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_vacations_date_range_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_vacations_teacher_dates
  ON public.teacher_vacations (teacher_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_teacher_vacations_date_range
  ON public.teacher_vacations (start_date, end_date);

ALTER TABLE public.teacher_vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_vacations_authenticated_read" ON public.teacher_vacations;
CREATE POLICY "teacher_vacations_authenticated_read"
  ON public.teacher_vacations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "teacher_vacations_admin_write" ON public.teacher_vacations;
CREATE POLICY "teacher_vacations_admin_write"
  ON public.teacher_vacations
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

GRANT SELECT ON public.teacher_vacations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_vacations TO authenticated;

COMMENT ON TABLE public.teacher_vacations IS
  '선생님별 휴가 기간. 해당 기간에는 수업 체크인 푸시를 보내지 않는다.';

NOTIFY pgrst, 'reload schema';
