-- 추가지급 개선: 신청 테이블, RLS, 코드 고정 추가수당 시드
-- schedule_payroll_patch_8_additional_payments.sql 이후 실행
--
-- additional_payments 실제 컬럼:
--   id, teacher_id, year_month, amount, reason, created_by

-- ============================================
-- RLS 헬퍼 (patch 16 미적용 DB 호환 — patch 27 등으로 superadmin만 있는 경우)
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
-- additional_payment_requests (강사 신청 → 슈퍼관리자 승인)
-- ============================================
CREATE TABLE IF NOT EXISTS public.additional_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  amount numeric(12, 0) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (char_length(trim(reason)) > 0),
  memo text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES public.teachers(id),
  reviewed_at timestamptz,
  additional_payment_id uuid REFERENCES public.additional_payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_additional_payment_requests_teacher_month
  ON public.additional_payment_requests (teacher_id, year_month DESC);

CREATE INDEX IF NOT EXISTS idx_additional_payment_requests_status
  ON public.additional_payment_requests (status, created_at DESC);

COMMENT ON TABLE public.additional_payment_requests IS
  '강사 추가수당 신청 — 승인 시 additional_payments에 반영';

-- ============================================
-- RLS: additional_payments (갱신)
-- ============================================
ALTER TABLE public.additional_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "additional_payments_admin_all" ON public.additional_payments;
DROP POLICY IF EXISTS "additional_payments_teacher_read" ON public.additional_payments;
DROP POLICY IF EXISTS "additional_payments_superadmin_all" ON public.additional_payments;
DROP POLICY IF EXISTS "additional_payments_regional_manager" ON public.additional_payments;

DO $$
BEGIN
  IF to_regprocedure('public.is_schedule_superadmin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "additional_payments_superadmin_all" ON public.additional_payments
        FOR ALL TO authenticated
        USING (public.is_schedule_superadmin())
        WITH CHECK (public.is_schedule_superadmin())
    $policy$;

    IF to_regprocedure('public.is_schedule_regional_manager()') IS NOT NULL
       AND to_regprocedure('public.teacher_at_managed_institution(uuid)') IS NOT NULL THEN
      EXECUTE $policy$
        CREATE POLICY "additional_payments_regional_manager" ON public.additional_payments
          FOR ALL TO authenticated
          USING (
            public.is_schedule_regional_manager()
            AND public.teacher_at_managed_institution(teacher_id)
          )
          WITH CHECK (
            public.is_schedule_regional_manager()
            AND public.teacher_at_managed_institution(teacher_id)
          )
      $policy$;
    END IF;
  ELSE
    EXECUTE $policy$
      CREATE POLICY "additional_payments_admin_all" ON public.additional_payments
        FOR ALL TO authenticated
        USING (public.is_schedule_admin())
        WITH CHECK (public.is_schedule_admin())
    $policy$;
  END IF;
END $$;

CREATE POLICY "additional_payments_teacher_read" ON public.additional_payments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================
-- RLS: additional_payment_requests
-- ============================================
ALTER TABLE public.additional_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "additional_payment_requests_teacher_read" ON public.additional_payment_requests;
CREATE POLICY "additional_payment_requests_teacher_read" ON public.additional_payment_requests
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "additional_payment_requests_teacher_insert" ON public.additional_payment_requests;
CREATE POLICY "additional_payment_requests_teacher_insert" ON public.additional_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "additional_payment_requests_superadmin_all" ON public.additional_payment_requests;
DROP POLICY IF EXISTS "additional_payment_requests_admin_all" ON public.additional_payment_requests;
DO $$
BEGIN
  IF to_regprocedure('public.is_schedule_superadmin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "additional_payment_requests_superadmin_all" ON public.additional_payment_requests
        FOR ALL TO authenticated
        USING (public.is_schedule_superadmin())
        WITH CHECK (public.is_schedule_superadmin())
    $policy$;
  ELSIF to_regprocedure('public.is_schedule_admin()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "additional_payment_requests_admin_all" ON public.additional_payment_requests
        FOR ALL TO authenticated
        USING (public.is_schedule_admin())
        WITH CHECK (public.is_schedule_admin())
    $policy$;
  END IF;
END $$;

-- ============================================
-- 마이그레이션: 코드 고정 추가수당 → DB
-- institutionTeacherPay.js TEACHER_INSTITUTION_ADDITIONAL + 김종현 monthly_bonus
-- ============================================
DO $$
DECLARE
  admin_id uuid;
  seed_month date := '2026-07-01'::date;
BEGIN
  SELECT id INTO admin_id
  FROM public.teachers
  WHERE role = 'superadmin'
  ORDER BY created_at
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE '슈퍼관리자 없음 — 추가수당 시드 스킵';
    RETURN;
  END IF;

  -- 윤한경 · 프랜시스파커 5만
  INSERT INTO public.additional_payments (
    teacher_id, year_month, amount, reason, created_by
  )
  SELECT t.id, seed_month, 50000, '프랜시스파커 추가수당', admin_id
  FROM public.teachers t
  WHERE t.name = '윤한경'
    AND NOT EXISTS (
      SELECT 1 FROM public.additional_payments ap
      WHERE ap.teacher_id = t.id
        AND ap.year_month = seed_month
        AND ap.reason = '프랜시스파커 추가수당'
    );

  -- 윤한경 · 관악SLP 5만
  INSERT INTO public.additional_payments (
    teacher_id, year_month, amount, reason, created_by
  )
  SELECT t.id, seed_month, 50000, '관악SLP 추가수당', admin_id
  FROM public.teachers t
  WHERE t.name = '윤한경'
    AND NOT EXISTS (
      SELECT 1 FROM public.additional_payments ap
      WHERE ap.teacher_id = t.id
        AND ap.year_month = seed_month
        AND ap.reason = '관악SLP 추가수당'
    );

  -- 김종현 · 수지폴리 본관 추가금 10만
  INSERT INTO public.additional_payments (
    teacher_id, year_month, amount, reason, created_by
  )
  SELECT t.id, seed_month, 100000, '추가금액', admin_id
  FROM public.teachers t
  WHERE t.name = '김종현'
    AND NOT EXISTS (
      SELECT 1 FROM public.additional_payments ap
      WHERE ap.teacher_id = t.id
        AND ap.year_month = seed_month
        AND ap.reason = '추가금액'
    );
END $$;
