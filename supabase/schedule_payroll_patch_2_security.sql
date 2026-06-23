-- 스케줄/급여 RLS 보안 마무리 패치
-- schedule_payroll.sql + schedule_payroll_patch.sql 실행 후 적용

ALTER TABLE public.institution_teacher_assignments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================
-- 1. current_teacher_pay_rates — security_invoker (UNRESTRICTED 해소)
-- ============================================
ALTER VIEW public.current_teacher_pay_rates SET (security_invoker = true);

-- 뷰 정의 재생성 (ALTER만으로 부족한 경우 대비)
CREATE OR REPLACE VIEW public.current_teacher_pay_rates
WITH (security_invoker = true) AS
SELECT DISTINCT ON (teacher_id, pay_type)
  id,
  teacher_id,
  pay_type,
  rate_per_minute,
  effective_from,
  created_at
FROM public.teacher_pay_rates
WHERE effective_from <= CURRENT_DATE
ORDER BY teacher_id, pay_type, effective_from DESC;

GRANT SELECT ON public.current_teacher_pay_rates TO authenticated;

-- ============================================
-- 2. get_teacher_pay_rates_as_of — INVOKER로 전환 (RLS 따름)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_teacher_pay_rates_as_of(p_as_of date)
RETURNS TABLE (
  teacher_id uuid,
  pay_type text,
  rate_per_minute numeric,
  effective_from date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (tpr.teacher_id, tpr.pay_type)
    tpr.teacher_id,
    tpr.pay_type,
    tpr.rate_per_minute,
    tpr.effective_from
  FROM public.teacher_pay_rates tpr
  WHERE tpr.effective_from <= p_as_of
  ORDER BY tpr.teacher_id, tpr.pay_type, tpr.effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_pay_rates_as_of(date) TO authenticated;

-- ============================================
-- 3. 강사용 배정 원 목록 (institutions 관리자 전용 유지 시)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_teacher_assigned_institutions()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  parking_info text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.name, i.address, i.parking_info, i.is_active
  FROM public.institutions i
  INNER JOIN public.institution_teacher_assignments a
    ON a.institution_id = i.id
  WHERE a.teacher_id = auth.uid()
    AND a.is_active = true
    AND i.is_active = true
  ORDER BY i.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_assigned_institutions() TO authenticated;

-- ============================================
-- 4. institutions — 관리자만 읽기/쓰기
-- ============================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions_teacher_read_assigned" ON public.institutions;

DROP POLICY IF EXISTS "institutions_admin_all" ON public.institutions;
CREATE POLICY "institutions_admin_all" ON public.institutions
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- ============================================
-- 5. institution_monthly_contracts — 관리자만
-- ============================================
ALTER TABLE public.institution_monthly_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_contracts_admin" ON public.institution_monthly_contracts;
CREATE POLICY "monthly_contracts_admin" ON public.institution_monthly_contracts
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- ============================================
-- 6. monthly_settlements — 관리자만
-- ============================================
ALTER TABLE public.monthly_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlements_admin" ON public.monthly_settlements;
CREATE POLICY "settlements_admin" ON public.monthly_settlements
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- ============================================
-- 7. institution_weekly_schedule — 관리자 전체 / 강사 배정 원만 읽기
-- ============================================
ALTER TABLE public.institution_weekly_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_schedule_admin" ON public.institution_weekly_schedule;
CREATE POLICY "weekly_schedule_admin" ON public.institution_weekly_schedule
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "weekly_schedule_teacher_read" ON public.institution_weekly_schedule;
CREATE POLICY "weekly_schedule_teacher_read" ON public.institution_weekly_schedule
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.institution_teacher_assignments a
      WHERE a.institution_id = institution_weekly_schedule.institution_id
        AND a.teacher_id = auth.uid()
        AND a.is_active = true
    )
  );

-- ============================================
-- 8. institution_schedule_exceptions — 관리자 전체 / 강사 배정 원만 읽기
-- ============================================
ALTER TABLE public.institution_schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_exceptions_admin" ON public.institution_schedule_exceptions;
CREATE POLICY "schedule_exceptions_admin" ON public.institution_schedule_exceptions
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "schedule_exceptions_teacher_read" ON public.institution_schedule_exceptions;
CREATE POLICY "schedule_exceptions_teacher_read" ON public.institution_schedule_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_teacher_assignments a
      WHERE a.institution_id = institution_schedule_exceptions.institution_id
        AND a.teacher_id = auth.uid()
        AND a.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.institution_weekly_schedule w
      WHERE w.institution_id = institution_schedule_exceptions.institution_id
        AND w.teacher_id = auth.uid()
    )
  );

-- ============================================
-- 9. payroll_entries — 강사 본인 / 관리자 전체
-- ============================================
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_admin_all" ON public.payroll_entries;
CREATE POLICY "payroll_admin_all" ON public.payroll_entries
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "payroll_teacher_own" ON public.payroll_entries;
CREATE POLICY "payroll_teacher_own" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "payroll_teacher_insert_own" ON public.payroll_entries;
CREATE POLICY "payroll_teacher_insert_own" ON public.payroll_entries
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "payroll_teacher_update_own" ON public.payroll_entries;
CREATE POLICY "payroll_teacher_update_own" ON public.payroll_entries
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "payroll_teacher_delete_own" ON public.payroll_entries;
CREATE POLICY "payroll_teacher_delete_own" ON public.payroll_entries
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================
-- 10. institution_teacher_assignments — 강사 본인 활성 배정만 읽기
-- ============================================
DROP POLICY IF EXISTS "assignments_teacher_read_own" ON public.institution_teacher_assignments;
CREATE POLICY "assignments_teacher_read_own" ON public.institution_teacher_assignments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND is_active = true);
