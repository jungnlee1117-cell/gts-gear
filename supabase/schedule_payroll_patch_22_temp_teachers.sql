-- 임시 선생님: Auth 없이 temp_teachers 테이블만 사용 (정산용 인력 정보)
-- schedule_payroll_patch_21 적용 후 실행

CREATE TABLE IF NOT EXISTS public.temp_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
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
  manual_session_count integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.teachers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_teachers_institution
  ON public.temp_teachers(institution_id, engagement_start_date);

ALTER TABLE public.temp_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temp_teachers_admin" ON public.temp_teachers;
CREATE POLICY "temp_teachers_admin" ON public.temp_teachers
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- patch_21 마이그레이션 (기존 temporary_teacher_engagements → temp_teachers)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'temporary_teacher_engagements'
  ) THEN
    INSERT INTO public.temp_teachers (
      name, phone, bank_name, bank_account,
      institution_id, pay_mode, rate_amount, pay_type,
      is_substitute, substitute_teacher_id, substitute_start_date, substitute_end_date,
      engagement_start_date, engagement_end_date, is_active, created_by, created_at
    )
    SELECT
      COALESCE(t.name, '임시 선생님'),
      COALESCE(t.phone, ''),
      '',
      '',
      e.institution_id,
      e.pay_mode,
      e.rate_amount,
      e.pay_type,
      e.is_substitute,
      e.substitute_teacher_id,
      e.substitute_start_date,
      e.substitute_end_date,
      e.engagement_start_date,
      e.engagement_end_date,
      e.is_active,
      e.created_by,
      e.created_at
    FROM public.temporary_teacher_engagements e
    LEFT JOIN public.teachers t ON t.id = e.teacher_id;

    DROP TABLE public.temporary_teacher_engagements;
  END IF;
END $$;
