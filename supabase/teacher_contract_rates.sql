-- 계약 급여 조건 (additive only)
-- 기존 teacher_contracts / 급여 계산 테이블은 변경하지 않음.
-- 서명완료 계약서는 그대로 두고, 조건 변경 시 새 계약 행을 발행.

ALTER TABLE public.teacher_contracts
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS phone_snapshot text,
  ADD COLUMN IF NOT EXISTS resident_id_front text;

COMMENT ON COLUMN public.teacher_contracts.phone_snapshot IS '발행 시점 연락처 스냅샷';
COMMENT ON COLUMN public.teacher_contracts.resident_id_front IS '주민등록번호 앞 6자리만. 전체 원문 저장 금지';

ALTER TABLE public.teacher_contracts
  DROP CONSTRAINT IF EXISTS teacher_contracts_source_check;
ALTER TABLE public.teacher_contracts
  ADD CONSTRAINT teacher_contracts_source_check
  CHECK (source = ANY (ARRAY['upload'::text, 'generated'::text]));

COMMENT ON COLUMN public.teacher_contracts.contract_type IS '계약 형태: 정규직, 위탁계약, 파트타임 등';
COMMENT ON COLUMN public.teacher_contracts.start_date IS '계약 시작일';
COMMENT ON COLUMN public.teacher_contracts.end_date IS '계약 종료일';
COMMENT ON COLUMN public.teacher_contracts.version IS '선생님별 계약 버전. 변경 계약은 새 행으로 증가';
COMMENT ON COLUMN public.teacher_contracts.source IS 'upload=직접 PDF, generated=표준 템플릿 발행';

CREATE TABLE IF NOT EXISTS public.teacher_contract_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.teacher_contracts(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  rate_type text NOT NULL
    CHECK (rate_type = ANY (ARRAY[
      'regular'::text,
      'after_school'::text,
      'event'::text,
      'private'::text,
      'center'::text,
      'assistant'::text,
      'transportation'::text,
      'custom'::text
    ])),
  rate_name text NOT NULL,
  amount numeric(12, 0) NOT NULL CHECK (amount > 0),
  unit text NOT NULL
    CHECK (unit = ANY (ARRAY['hour'::text, 'session'::text, 'day'::text, 'month'::text, 'item'::text])),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_contract_rates_contract_idx
  ON public.teacher_contract_rates (contract_id, sort_order);
CREATE INDEX IF NOT EXISTS teacher_contract_rates_teacher_idx
  ON public.teacher_contract_rates (teacher_id, created_at DESC);

COMMENT ON TABLE public.teacher_contract_rates IS
  '계약별 급여 조건. 기존 급여 계산 로직은 변경하지 않음. 추후 teacher_id/contract_id 로 참조.';
COMMENT ON COLUMN public.teacher_contract_rates.rate_type IS
  'regular | after_school | event | private | center | assistant | transportation | custom';

ALTER TABLE public.teacher_contract_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_contract_rates_select" ON public.teacher_contract_rates;
CREATE POLICY "teacher_contract_rates_select" ON public.teacher_contract_rates
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_teacher_superadmin()
  );

DROP POLICY IF EXISTS "teacher_contract_rates_insert_superadmin" ON public.teacher_contract_rates;
CREATE POLICY "teacher_contract_rates_insert_superadmin" ON public.teacher_contract_rates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_contract_rates_update_superadmin" ON public.teacher_contract_rates;
CREATE POLICY "teacher_contract_rates_update_superadmin" ON public.teacher_contract_rates
  FOR UPDATE TO authenticated
  USING (public.is_teacher_superadmin())
  WITH CHECK (public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_contract_rates_delete_superadmin" ON public.teacher_contract_rates;
CREATE POLICY "teacher_contract_rates_delete_superadmin" ON public.teacher_contract_rates
  FOR DELETE TO authenticated
  USING (public.is_teacher_superadmin());

CREATE OR REPLACE FUNCTION public.prevent_signed_contract_rate_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status text;
  parent_id uuid;
BEGIN
  parent_id := COALESCE(NEW.contract_id, OLD.contract_id);
  SELECT status INTO parent_status
  FROM public.teacher_contracts
  WHERE id = parent_id;
  IF parent_status = '서명완료' THEN
    RAISE EXCEPTION '서명 완료된 계약의 급여 조건은 수정할 수 없습니다. 변경이 필요하면 새 계약서를 발행하세요.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS teacher_contract_rates_lock_signed ON public.teacher_contract_rates;
CREATE TRIGGER teacher_contract_rates_lock_signed
  BEFORE INSERT OR UPDATE OR DELETE ON public.teacher_contract_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_contract_rate_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_contract_rates TO authenticated;
GRANT ALL ON public.teacher_contract_rates TO service_role;
