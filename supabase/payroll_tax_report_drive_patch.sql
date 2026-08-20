-- GTS 월별 사업소득 Excel Google Drive 저장 이력
-- 주민등록번호 및 계좌번호 원문은 저장하지 않습니다.

CREATE TABLE IF NOT EXISTS public.payroll_tax_report_drive_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month date NOT NULL,
  filename text NOT NULL,
  drive_file_id text,
  drive_file_url text,
  status text NOT NULL CHECK (status IN ('uploaded', 'failed')),
  error_code text,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_tax_report_drive_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_tax_drive_uploads_superadmin"
  ON public.payroll_tax_report_drive_uploads;
CREATE POLICY "payroll_tax_drive_uploads_superadmin"
  ON public.payroll_tax_report_drive_uploads
  FOR SELECT TO authenticated
  USING (public.is_schedule_superadmin());

CREATE INDEX IF NOT EXISTS idx_payroll_tax_drive_upload_month
  ON public.payroll_tax_report_drive_uploads(year_month, created_at DESC);

COMMENT ON TABLE public.payroll_tax_report_drive_uploads IS
  '매월 사업소득 Excel의 Google Drive 저장 결과. 민감정보 원문은 보관하지 않음';
