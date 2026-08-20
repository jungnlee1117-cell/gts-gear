-- 마이페이지 2차 QA (additive only)
-- 이미 teacher_contracts_and_settlement.sql 을 실행한 환경에서만 추가로 실행.

ALTER TABLE public.teacher_contracts
  ADD COLUMN IF NOT EXISTS agreed_at timestamptz;

COMMENT ON COLUMN public.teacher_contracts.agreed_at IS
  '계약내용 확인 및 전자서명 동의 시각. 서명 완료 시 서버에서 기록.';

CREATE OR REPLACE FUNCTION public.prevent_signed_teacher_contract_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = '서명완료' THEN
    RAISE EXCEPTION '서명 완료된 계약서는 삭제할 수 없습니다. 변경이 필요하면 새 계약서를 등록하세요.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = '서명완료' THEN
    RAISE EXCEPTION '서명 완료된 계약서는 수정할 수 없습니다. 변경이 필요하면 새 계약서를 등록하세요.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = '서명완료' THEN
    IF NEW.signed_by IS NULL OR NEW.signed_at IS NULL OR NEW.signed_pdf_path IS NULL OR NEW.agreed_at IS NULL THEN
      RAISE EXCEPTION '서명 완료 처리에는 signed_by, signed_at, signed_pdf_path, agreed_at이 필요합니다.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP POLICY IF EXISTS "teacher_contracts_update_superadmin" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_update_superadmin" ON public.teacher_contracts
  FOR UPDATE TO authenticated
  USING (public.is_teacher_superadmin() AND status = '서명대기')
  WITH CHECK (public.is_teacher_superadmin() AND status = '서명대기');

DROP POLICY IF EXISTS "teacher_contracts_delete_superadmin" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_delete_superadmin" ON public.teacher_contracts
  FOR DELETE TO authenticated
  USING (public.is_teacher_superadmin() AND status = '서명대기');

DROP POLICY IF EXISTS "teacher_contracts_storage_update" ON storage.objects;
CREATE POLICY "teacher_contracts_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'teacher-contracts'
    AND public.is_teacher_superadmin()
    AND name NOT LIKE '%/signed.pdf'
    AND name NOT LIKE '%/signature.png'
  );

DROP POLICY IF EXISTS "teacher_contracts_storage_delete" ON storage.objects;
CREATE POLICY "teacher_contracts_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-contracts'
    AND public.is_teacher_superadmin()
    AND name NOT LIKE '%/signed.pdf'
    AND name NOT LIKE '%/signature.png'
  );
