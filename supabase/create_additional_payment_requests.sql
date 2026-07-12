-- additional_payment_requests 테이블 생성 (404 대응)
-- schedule_payroll_patch_25 미적용 DB에서 단독 실행 가능하도록 self-contained 구성
-- 이미 존재하면 안전하게 스킵 / 정책만 재적용

-- ============================================
-- 1) 테이블
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
-- 2) RLS
-- ============================================
ALTER TABLE public.additional_payment_requests ENABLE ROW LEVEL SECURITY;

-- 강사 본인: 조회
DROP POLICY IF EXISTS "additional_payment_requests_teacher_read" ON public.additional_payment_requests;
CREATE POLICY "additional_payment_requests_teacher_read" ON public.additional_payment_requests
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- 강사 본인: pending 상태로 신청
DROP POLICY IF EXISTS "additional_payment_requests_teacher_insert" ON public.additional_payment_requests;
CREATE POLICY "additional_payment_requests_teacher_insert" ON public.additional_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND status = 'pending'
  );

-- 관리자: 전체 관리 (헬퍼 함수 존재 여부에 따라 적용)
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
  ELSE
    -- 헬퍼 함수가 없는 DB: superadmin 역할 직접 확인
    EXECUTE $policy$
      CREATE POLICY "additional_payment_requests_admin_all" ON public.additional_payment_requests
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
          )
        )
    $policy$;
  END IF;
END $$;
