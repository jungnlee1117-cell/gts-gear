-- notices: 기관 공개 범위 (institution_id) + 행사 일정 기간/유형
-- Supabase SQL Editor에서 실행
-- 선행: schedule_payroll_patch_16 (is_schedule_superadmin, manages_institution)

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS event_end_date date;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS exception_type text;

COMMENT ON COLUMN public.notices.institution_id IS
  'NULL=전체 공개. 값이 있으면 해당 기관 담당 선생님·담당 관리자(+슈퍼관리자)만 조회';
COMMENT ON COLUMN public.notices.event_end_date IS
  '행사 종료일 (선택). event_date와 함께 institution_schedule_exceptions.end_date로 동기화';
COMMENT ON COLUMN public.notices.exception_type IS
  '연동 예외 유형: cancelled|event|time_change';

CREATE INDEX IF NOT EXISTS idx_notices_institution_id
  ON public.notices (institution_id)
  WHERE institution_id IS NOT NULL;

DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT TO authenticated
  USING (
    institution_id IS NULL
    OR public.is_schedule_superadmin()
    OR public.manages_institution(institution_id)
    OR EXISTS (
      SELECT 1
      FROM public.institution_teacher_assignments a
      WHERE a.institution_id = notices.institution_id
        AND a.teacher_id = auth.uid()
        AND a.is_active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.institution_weekly_schedule w
      WHERE w.institution_id = notices.institution_id
        AND w.teacher_id = auth.uid()
    )
  );
