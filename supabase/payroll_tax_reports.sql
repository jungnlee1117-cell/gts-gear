-- 세무사 제출용 월별 사업소득 엑셀 스냅샷
-- 급여 계산 결과만 보관하며 주민등록번호 원문은 이 테이블에 저장하지 않습니다.

CREATE TABLE IF NOT EXISTS public.payroll_tax_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month date NOT NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_name text NOT NULL,
  income_type text NOT NULL DEFAULT '위탁수업'
    CHECK (income_type IN ('위탁수업', '계약직')),
  gross_amount numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_month, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.payroll_tax_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month date NOT NULL,
  recipient_email text NOT NULL,
  filename text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_tax_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_tax_report_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_tax_snapshots_superadmin" ON public.payroll_tax_report_snapshots;
CREATE POLICY "payroll_tax_snapshots_superadmin"
  ON public.payroll_tax_report_snapshots
  FOR ALL TO authenticated
  USING (public.is_schedule_superadmin())
  WITH CHECK (public.is_schedule_superadmin());

DROP POLICY IF EXISTS "payroll_tax_deliveries_superadmin" ON public.payroll_tax_report_deliveries;
CREATE POLICY "payroll_tax_deliveries_superadmin"
  ON public.payroll_tax_report_deliveries
  FOR SELECT TO authenticated
  USING (public.is_schedule_superadmin());

CREATE INDEX IF NOT EXISTS idx_payroll_tax_snapshot_month
  ON public.payroll_tax_report_snapshots(year_month, sort_order);

COMMENT ON TABLE public.payroll_tax_report_snapshots IS
  '급여 대시보드의 월별 확정/예상 세전 지급액 스냅샷. 주민번호는 teacher_settlement_profiles에서 생성 시에만 복호화';
