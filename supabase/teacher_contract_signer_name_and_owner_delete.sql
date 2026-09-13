-- 전자서명자 이름 보관 + 계약 대표의 서명완료 계약서 삭제 허용
-- 삭제 요청은 teacher-hr Edge Function에서 대표 권한을 확인한 후 service_role로만 실행한다.

ALTER TABLE public.teacher_contracts
  ADD COLUMN IF NOT EXISTS signer_name text;

COMMENT ON COLUMN public.teacher_contracts.signer_name IS
  '전자서명 시 계약자가 직접 입력하고 서버에서 등록 성명과 대조한 이름';

CREATE OR REPLACE FUNCTION public.prevent_signed_teacher_contract_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = '서명완료' THEN
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION '서명 완료된 계약서는 계약 관리자 확인 절차를 통해서만 삭제할 수 있습니다.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = '서명완료' THEN
    RAISE EXCEPTION '서명 완료된 계약서는 수정할 수 없습니다. 변경이 필요하면 새 계약서를 등록하세요.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = '서명완료' THEN
    IF NEW.signed_by IS NULL
      OR NEW.signed_at IS NULL
      OR NEW.signed_pdf_path IS NULL
      OR NEW.agreed_at IS NULL
      OR length(trim(COALESCE(NEW.signer_name, ''))) < 2 THEN
      RAISE EXCEPTION '서명 완료 처리에는 signed_by, signed_at, signed_pdf_path, agreed_at, signer_name이 필요합니다.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 일반 로그인 사용자는 기존처럼 서명대기 계약서만 직접 삭제할 수 있다.
DROP POLICY IF EXISTS contracts_owner_delete ON public.teacher_contracts;
CREATE POLICY contracts_owner_delete ON public.teacher_contracts
  AS RESTRICTIVE FOR DELETE TO public
  USING (public.is_contract_owner() AND status = '서명대기');
