-- 교사 수업 참관·모니터링 평가표 (관리자 3인 전용: 대표 + 양의인 + 오정석)
CREATE TABLE IF NOT EXISTS public.teacher_monitoring_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  observer_name text NOT NULL DEFAULT '',
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_name text NOT NULL,
  facility_name text NOT NULL DEFAULT '',
  class_name text NOT NULL DEFAULT '',
  observed_on date NOT NULL,
  observed_time text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT 'regular' CHECK (purpose IN ('regular', 'intensive')),
  template_version text NOT NULL DEFAULT 'v1',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  excellent_count int NOT NULL DEFAULT 0,
  adequate_count int NOT NULL DEFAULT 0,
  needs_count int NOT NULL DEFAULT 0,
  positive_comment text NOT NULL DEFAULT '',
  improvement_comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_monitoring_evaluations_observed_idx
  ON public.teacher_monitoring_evaluations (observed_on DESC);
CREATE INDEX IF NOT EXISTS teacher_monitoring_evaluations_teacher_idx
  ON public.teacher_monitoring_evaluations (teacher_id);

-- 접근 권한: 슈퍼관리자(대표) + 양의인 + 오정석
CREATE OR REPLACE FUNCTION public.can_manage_teacher_monitoring()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid()
      AND (t.role = 'superadmin' OR t.name IN ('양의인', '오정석'))
  );
$$;

ALTER TABLE public.teacher_monitoring_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_monitoring_select ON public.teacher_monitoring_evaluations;
CREATE POLICY teacher_monitoring_select ON public.teacher_monitoring_evaluations
  FOR SELECT TO authenticated USING (public.can_manage_teacher_monitoring());

DROP POLICY IF EXISTS teacher_monitoring_insert ON public.teacher_monitoring_evaluations;
CREATE POLICY teacher_monitoring_insert ON public.teacher_monitoring_evaluations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_teacher_monitoring());

DROP POLICY IF EXISTS teacher_monitoring_update ON public.teacher_monitoring_evaluations;
CREATE POLICY teacher_monitoring_update ON public.teacher_monitoring_evaluations
  FOR UPDATE TO authenticated
  USING (public.can_manage_teacher_monitoring())
  WITH CHECK (public.can_manage_teacher_monitoring());

DROP POLICY IF EXISTS teacher_monitoring_delete ON public.teacher_monitoring_evaluations;
CREATE POLICY teacher_monitoring_delete ON public.teacher_monitoring_evaluations
  FOR DELETE TO authenticated USING (public.can_manage_teacher_monitoring());
