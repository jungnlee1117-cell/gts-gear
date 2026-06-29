-- 임시 선생님 등록 · 기관별 근무 · 정산 연동
-- schedule_payroll_patch_20 이후 적용
-- ※ Auth 연동 방식은 폐기됨 → schedule_payroll_patch_22_temp_teachers.sql 사용

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.temporary_teacher_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  pay_mode text NOT NULL CHECK (pay_mode IN ('hourly', 'per_session')),
  rate_amount numeric(12, 0) NOT NULL DEFAULT 0,
  pay_type text NOT NULL DEFAULT '정규' CHECK (pay_type IN ('정규', '방과후', '가정방문', '센터', '센터보조')),
  is_substitute boolean NOT NULL DEFAULT false,
  substitute_teacher_id uuid REFERENCES public.teachers(id),
  substitute_start_date date,
  substitute_end_date date,
  engagement_start_date date NOT NULL,
  engagement_end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.teachers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_engagements_institution
  ON public.temporary_teacher_engagements(institution_id, engagement_start_date);

CREATE INDEX IF NOT EXISTS idx_temp_engagements_teacher
  ON public.temporary_teacher_engagements(teacher_id, engagement_start_date);

ALTER TABLE public.temporary_teacher_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temp_engagements_admin" ON public.temporary_teacher_engagements;
CREATE POLICY "temp_engagements_admin" ON public.temporary_teacher_engagements
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());
