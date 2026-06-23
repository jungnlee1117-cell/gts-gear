-- 정산 확장: 회당과금(per_session) + 파트너과금(partner_billing) + 고정지급(manager_fixed_payout)
-- schedule_payroll_patch_2_security.sql 실행 후 적용

-- ============================================
-- 1. institutions 확장
-- ============================================
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS fixed_payout_recipient_id uuid REFERENCES public.teachers(id),
  ADD COLUMN IF NOT EXISTS fixed_payout_amount numeric(12, 0);

ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_contract_type_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_contract_type_check
  CHECK (contract_type IN (
    'gts_official', 'manager_personal', 'manager_fixed_payout', 'partner_billing'
  ));

ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_billing_type_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_billing_type_check
  CHECK (billing_type IN ('monthly_fixed', 'per_session', 'manual'));

-- hourly → manual 마이그레이션 (기존 데이터)
UPDATE public.institutions SET billing_type = 'manual' WHERE billing_type = 'hourly';

-- ============================================
-- 2. 회당 단가 (이력)
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_session_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  rate_per_session numeric(10, 0) NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_rates_institution
  ON public.institution_session_rates(institution_id, session_type, effective_from DESC);

-- ============================================
-- 3. 월별 진행 횟수
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_monthly_session_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  session_type text NOT NULL,
  session_count int NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (institution_id, year_month, session_type)
);

CREATE INDEX IF NOT EXISTS idx_session_counts_institution_month
  ON public.institution_monthly_session_counts(institution_id, year_month);

-- ============================================
-- 4. monthly_settlements 확장
-- ============================================
ALTER TABLE public.monthly_settlements
  ADD COLUMN IF NOT EXISTS partner_invoice_amount numeric(12, 0) NOT NULL DEFAULT 0;

ALTER TABLE public.monthly_settlements
  ADD COLUMN IF NOT EXISTS fixed_payout numeric(12, 0) NOT NULL DEFAULT 0;

-- ============================================
-- 5. RLS — 신규 테이블 (관리자 전용)
-- ============================================
ALTER TABLE public.institution_session_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_rates_admin" ON public.institution_session_rates;
CREATE POLICY "session_rates_admin" ON public.institution_session_rates
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

ALTER TABLE public.institution_monthly_session_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_counts_admin" ON public.institution_monthly_session_counts;
CREATE POLICY "session_counts_admin" ON public.institution_monthly_session_counts
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());
