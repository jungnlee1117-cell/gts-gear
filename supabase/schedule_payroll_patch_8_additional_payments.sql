-- 추가 지급 (관리자 입력, 강사 읽기 전용)
-- schedule_payroll_patch_7_teacher_notes.sql 실행 후 적용

CREATE TABLE IF NOT EXISTS public.additional_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year_month date NOT NULL,
  amount numeric(12, 0) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (char_length(trim(reason)) > 0),
  created_by uuid NOT NULL REFERENCES public.teachers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_additional_payments_teacher_month
  ON public.additional_payments (teacher_id, year_month DESC);

COMMENT ON TABLE public.additional_payments IS '강사 월별 추가 지급 — 관리자만 입력, 강사 본인 읽기';
COMMENT ON COLUMN public.additional_payments.year_month IS '해당 월 1일 (예: 2026-06-01)';

ALTER TABLE public.additional_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "additional_payments_admin_all" ON public.additional_payments;
CREATE POLICY "additional_payments_admin_all" ON public.additional_payments
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

DROP POLICY IF EXISTS "additional_payments_teacher_read" ON public.additional_payments;
CREATE POLICY "additional_payments_teacher_read" ON public.additional_payments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
