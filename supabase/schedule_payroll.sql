-- GTS 강사 스케줄 · 급여 · 원 정산
-- Supabase SQL Editor에서 실행 (기존 public.teachers 테이블 사용)

-- ============================================
-- 1. 학원/기관 마스터
-- ============================================
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  parking_info text,
  business_registration_number text,
  manager_id uuid REFERENCES public.teachers(id),
  contract_type text NOT NULL CHECK (contract_type IN (
    'gts_official', 'manager_personal', 'manager_fixed_payout', 'partner_billing'
  )),
  billing_type text NOT NULL CHECK (billing_type IN ('monthly_fixed', 'per_session', 'manual')),
  fixed_payout_recipient_id uuid REFERENCES public.teachers(id),
  fixed_payout_amount numeric(12, 0),
  contract_start_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. 원별 배정 강사 (N:N)
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  pay_types text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (institution_id, teacher_id)
);

-- ============================================
-- 3. 원별 월간 계약/매출 (이력)
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_monthly_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  contract_amount numeric(12,0) NOT NULL DEFAULT 0,
  student_count int,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (institution_id, year_month)
);

-- ============================================
-- 4. 원 기본 주간 시간표 (매주 반복)
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_weekly_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  class_type text NOT NULL CHECK (class_type IN ('정규', '방과후')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. 시간표 예외 (특정 날짜)
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  exception_type text NOT NULL CHECK (exception_type IN ('cancelled', 'event', 'time_change')),
  note text,
  adjusted_start_time time,
  adjusted_end_time time,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 6. 강사별 수업유형별 단가 (이력)
-- ============================================
CREATE TABLE IF NOT EXISTS public.teacher_pay_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  pay_type text NOT NULL CHECK (pay_type IN ('정규', '방과후', '가정방문', '센터', '센터보조')),
  rate_per_minute numeric(10,2) NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. 강사 수업시간 입력
-- ============================================
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id),
  class_date date NOT NULL,
  pay_type text NOT NULL CHECK (pay_type IN ('정규', '방과후', '가정방문', '센터', '센터보조')),
  minutes int NOT NULL CHECK (minutes > 0),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 7b. 회당 단가 · 월별 진행 횟수
-- ============================================
CREATE TABLE IF NOT EXISTS public.institution_session_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  rate_per_session numeric(10, 0) NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

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

-- ============================================
-- 8. 원별 월간 정산 결과
-- ============================================
CREATE TABLE IF NOT EXISTS public.monthly_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  revenue numeric(12,0) NOT NULL DEFAULT 0,
  vat numeric(12,0) NOT NULL DEFAULT 0,
  revenue_after_vat numeric(12,0) NOT NULL DEFAULT 0,
  income_tax numeric(12,0) NOT NULL DEFAULT 0,
  revenue_after_tax numeric(12,0) NOT NULL DEFAULT 0,
  instructor_cost numeric(12,0) NOT NULL DEFAULT 0,
  net_profit numeric(12,0) NOT NULL DEFAULT 0,
  manager_share numeric(12,0) NOT NULL DEFAULT 0,
  gts_share numeric(12,0) NOT NULL DEFAULT 0,
  partner_invoice_amount numeric(12,0) NOT NULL DEFAULT 0,
  fixed_payout numeric(12,0) NOT NULL DEFAULT 0,
  is_finalized boolean DEFAULT false,
  finalized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (institution_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_teacher_date ON public.payroll_entries(teacher_id, class_date);
CREATE INDEX IF NOT EXISTS idx_payroll_institution_date ON public.payroll_entries(institution_id, class_date);
CREATE INDEX IF NOT EXISTS idx_settlements_year_month ON public.monthly_settlements(year_month);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_institution ON public.institution_weekly_schedule(institution_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.institution_teacher_assignments(teacher_id);

-- ============================================
-- RLS helper
-- ============================================
CREATE OR REPLACE FUNCTION public.is_schedule_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
  );
$$;

-- ============================================
-- institutions
-- ============================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions_admin_all" ON public.institutions;
CREATE POLICY "institutions_admin_all" ON public.institutions
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- 강사는 institutions 직접 조회 불가 → get_teacher_assigned_institutions() RPC 사용

-- ============================================
-- institution_teacher_assignments
-- ============================================
ALTER TABLE public.institution_teacher_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_admin_all" ON public.institution_teacher_assignments;
CREATE POLICY "assignments_admin_all" ON public.institution_teacher_assignments
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "assignments_teacher_read_own" ON public.institution_teacher_assignments;
CREATE POLICY "assignments_teacher_read_own" ON public.institution_teacher_assignments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND is_active = true);

-- ============================================
-- institution_monthly_contracts (admin only)
-- ============================================
ALTER TABLE public.institution_monthly_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_contracts_admin" ON public.institution_monthly_contracts;
CREATE POLICY "monthly_contracts_admin" ON public.institution_monthly_contracts
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- ============================================
-- institution_weekly_schedule
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
-- institution_schedule_exceptions
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
-- teacher_pay_rates
-- ============================================
ALTER TABLE public.teacher_pay_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_rates_admin" ON public.teacher_pay_rates;
CREATE POLICY "pay_rates_admin" ON public.teacher_pay_rates
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "pay_rates_teacher_read_own" ON public.teacher_pay_rates;
CREATE POLICY "pay_rates_teacher_read_own" ON public.teacher_pay_rates
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================
-- payroll_entries
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
-- monthly_settlements (admin only)
-- ============================================
ALTER TABLE public.monthly_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlements_admin" ON public.monthly_settlements;
CREATE POLICY "settlements_admin" ON public.monthly_settlements
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- ============================================
-- institution_session_rates / session_counts (admin only)
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
