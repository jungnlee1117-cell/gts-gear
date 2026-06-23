-- 지역 관리자(manager_id) 스코프 RLS + 슈퍼관리자 전체 접근
-- schedule_payroll_patch_15_extra_added_notification.sql 이후 적용

-- ============================================
-- 헬퍼 함수
-- ============================================
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

CREATE OR REPLACE FUNCTION public.is_schedule_regional_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role = 'admin'
  ) AND NOT public.is_schedule_superadmin();
$$;

CREATE OR REPLACE FUNCTION public.manages_institution(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_schedule_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = p_institution_id AND i.manager_id = auth.uid()
    );
$$;

-- 지역 관리자는 manager_fixed_payout 원의 매출·정산 상세 조회 불가 (고정지급만 UI 표시)
CREATE OR REPLACE FUNCTION public.manager_can_view_institution_revenue(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_schedule_superadmin()
    OR (
      public.manages_institution(p_institution_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.institutions i
        WHERE i.id = p_institution_id
          AND i.contract_type = 'manager_fixed_payout'
          AND public.is_schedule_regional_manager()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.teacher_at_managed_institution(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_schedule_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.institution_teacher_assignments a
      WHERE a.teacher_id = p_teacher_id
        AND a.is_active = true
        AND public.manages_institution(a.institution_id)
    );
$$;

-- ============================================
-- institutions
-- ============================================
DROP POLICY IF EXISTS "institutions_admin_all" ON public.institutions;
CREATE POLICY "institutions_admin_all" ON public.institutions
  FOR ALL TO authenticated
  USING (
    public.is_schedule_superadmin()
    OR (public.is_schedule_regional_manager() AND manager_id = auth.uid())
  )
  WITH CHECK (
    public.is_schedule_superadmin()
    OR (public.is_schedule_regional_manager() AND manager_id = auth.uid())
  );

-- ============================================
-- institution_monthly_contracts
-- ============================================
DROP POLICY IF EXISTS "monthly_contracts_admin" ON public.institution_monthly_contracts;
CREATE POLICY "monthly_contracts_admin" ON public.institution_monthly_contracts
  FOR ALL TO authenticated
  USING (public.manager_can_view_institution_revenue(institution_id))
  WITH CHECK (public.manager_can_view_institution_revenue(institution_id));

-- ============================================
-- monthly_settlements
-- ============================================
DROP POLICY IF EXISTS "settlements_admin" ON public.monthly_settlements;
CREATE POLICY "settlements_admin" ON public.monthly_settlements
  FOR ALL TO authenticated
  USING (public.manager_can_view_institution_revenue(institution_id))
  WITH CHECK (public.manager_can_view_institution_revenue(institution_id));

-- ============================================
-- institution_session_rates / session_counts
-- ============================================
DROP POLICY IF EXISTS "session_rates_admin" ON public.institution_session_rates;
CREATE POLICY "session_rates_admin" ON public.institution_session_rates
  FOR ALL TO authenticated
  USING (public.manager_can_view_institution_revenue(institution_id))
  WITH CHECK (public.manager_can_view_institution_revenue(institution_id));

DROP POLICY IF EXISTS "session_counts_admin" ON public.institution_monthly_session_counts;
CREATE POLICY "session_counts_admin" ON public.institution_monthly_session_counts
  FOR ALL TO authenticated
  USING (public.manager_can_view_institution_revenue(institution_id))
  WITH CHECK (public.manager_can_view_institution_revenue(institution_id));

-- ============================================
-- institution_weekly_schedule
-- ============================================
DROP POLICY IF EXISTS "weekly_schedule_admin" ON public.institution_weekly_schedule;
CREATE POLICY "weekly_schedule_admin" ON public.institution_weekly_schedule
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id))
  WITH CHECK (public.manages_institution(institution_id));

-- ============================================
-- institution_schedule_exceptions
-- ============================================
DROP POLICY IF EXISTS "schedule_exceptions_admin" ON public.institution_schedule_exceptions;
CREATE POLICY "schedule_exceptions_admin" ON public.institution_schedule_exceptions
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id))
  WITH CHECK (public.manages_institution(institution_id));

-- ============================================
-- institution_teacher_assignments
-- ============================================
DROP POLICY IF EXISTS "assignments_admin_all" ON public.institution_teacher_assignments;
CREATE POLICY "assignments_admin_all" ON public.institution_teacher_assignments
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id))
  WITH CHECK (public.manages_institution(institution_id));

-- ============================================
-- payroll_entries
-- ============================================
DROP POLICY IF EXISTS "payroll_admin_all" ON public.payroll_entries;
CREATE POLICY "payroll_admin_all" ON public.payroll_entries
  FOR ALL TO authenticated
  USING (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  );

-- ============================================
-- teacher_pay_rates — 담당 원 강사만
-- ============================================
DROP POLICY IF EXISTS "pay_rates_admin" ON public.teacher_pay_rates;
CREATE POLICY "pay_rates_admin" ON public.teacher_pay_rates
  FOR ALL TO authenticated
  USING (public.teacher_at_managed_institution(teacher_id))
  WITH CHECK (public.teacher_at_managed_institution(teacher_id));

-- ============================================
-- schedule_change_notifications
-- ============================================
DROP POLICY IF EXISTS "schedule_change_admin_read" ON public.schedule_change_notifications;
CREATE POLICY "schedule_change_admin_read" ON public.schedule_change_notifications
  FOR SELECT TO authenticated
  USING (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "schedule_change_admin_update" ON public.schedule_change_notifications;
CREATE POLICY "schedule_change_admin_update" ON public.schedule_change_notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_schedule_superadmin()
    OR (
      public.is_schedule_regional_manager()
      AND (
        (institution_id IS NOT NULL AND public.manages_institution(institution_id))
        OR (
          institution_id IS NULL
          AND public.teacher_at_managed_institution(teacher_id)
        )
      )
    )
  );

-- ============================================
-- additional_payments
-- ============================================
DROP POLICY IF EXISTS "additional_payments_admin_all" ON public.additional_payments;
CREATE POLICY "additional_payments_admin_all" ON public.additional_payments
  FOR ALL TO authenticated
  USING (public.teacher_at_managed_institution(teacher_id))
  WITH CHECK (public.teacher_at_managed_institution(teacher_id));

-- ============================================
-- home_visit_patterns / home_visit_schedules
-- ============================================
DROP POLICY IF EXISTS "home_visit_patterns_admin_all" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_admin_all" ON public.home_visit_patterns
  FOR ALL TO authenticated
  USING (public.teacher_at_managed_institution(teacher_id))
  WITH CHECK (public.teacher_at_managed_institution(teacher_id));

DROP POLICY IF EXISTS "home_visit_admin_all" ON public.home_visit_schedules;
CREATE POLICY "home_visit_admin_all" ON public.home_visit_schedules
  FOR ALL TO authenticated
  USING (public.teacher_at_managed_institution(teacher_id))
  WITH CHECK (public.teacher_at_managed_institution(teacher_id));

-- ============================================
-- teacher_notes — 담당 원 강사 메모만
-- ============================================
DROP POLICY IF EXISTS "teacher_notes_admin_read" ON public.teacher_notes;
CREATE POLICY "teacher_notes_admin_read" ON public.teacher_notes
  FOR SELECT TO authenticated
  USING (public.teacher_at_managed_institution(teacher_id));
