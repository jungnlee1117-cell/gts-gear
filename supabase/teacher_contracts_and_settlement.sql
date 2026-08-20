-- 선생님 마이페이지 2차: 정산정보(암호화) + 계약서
-- additive only. 기존 teachers / 급여 / 교구 테이블은 변경하지 않음.
-- Supabase SQL Editor에서 실행 후:
--   1) Edge Function secret: SETTLEMENT_ENCRYPTION_KEY 설정 (openssl rand -base64 32)
--   2) supabase functions deploy teacher-hr
-- 이미 이 파일을 실행한 환경은 supabase/teacher_hr_qa_patch.sql 만 추가 실행.

-- ═══════════════════════════════════════════════
-- 1. 정산정보 (teachers 와 분리, 암호문은 클라이언트에 노출하지 않음)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teacher_settlement_profiles (
  teacher_id uuid PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
  bank_name text,
  account_holder text,
  account_number_ciphertext text,
  resident_id_ciphertext text,
  account_number_mask text,
  resident_id_mask text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.teachers(id)
);

COMMENT ON TABLE public.teacher_settlement_profiles IS
  '급여 정산용 계좌·주민번호. 민감값은 Edge Function에서 AES-GCM 암호화 후 저장. teacher_id로 기존 급여 시스템과 연결.';
COMMENT ON COLUMN public.teacher_settlement_profiles.account_number_ciphertext IS
  '계좌번호 암호문. 클라이언트 SELECT 금지 (RLS).';
COMMENT ON COLUMN public.teacher_settlement_profiles.resident_id_ciphertext IS
  '주민등록번호 암호문. 클라이언트 SELECT 금지 (RLS).';
COMMENT ON COLUMN public.teacher_settlement_profiles.account_number_mask IS
  '화면 표시용 마스킹 계좌번호';
COMMENT ON COLUMN public.teacher_settlement_profiles.resident_id_mask IS
  '화면 표시용 마스킹 주민등록번호 (예: 900101-1******)';

ALTER TABLE public.teacher_settlement_profiles ENABLE ROW LEVEL SECURITY;

-- authenticated 직접 접근 차단. service_role(Edge Function)만 읽고 씀.
DROP POLICY IF EXISTS "settlement_profiles_no_direct" ON public.teacher_settlement_profiles;
REVOKE ALL ON public.teacher_settlement_profiles FROM anon, authenticated;
GRANT ALL ON public.teacher_settlement_profiles TO service_role;

-- ═══════════════════════════════════════════════
-- 2. 계약서
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teacher_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  contract_date date,
  status text NOT NULL DEFAULT '서명대기'
    CHECK (status = ANY (ARRAY['서명대기'::text, '서명완료'::text])),
  original_pdf_path text,
  original_pdf_url text,
  original_pdf_hash text,
  signed_pdf_path text,
  signed_pdf_url text,
  signed_pdf_hash text,
  signature_path text,
  agreed_at timestamptz,
  signed_at timestamptz,
  signed_by uuid REFERENCES public.teachers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.teachers(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_contracts_teacher_id_idx
  ON public.teacher_contracts (teacher_id, created_at DESC);

COMMENT ON TABLE public.teacher_contracts IS
  '선생님 계약서. 서명완료 건은 수정 불가 — 변경 시 새 행을 등록.';
COMMENT ON COLUMN public.teacher_contracts.original_pdf_url IS
  '비공개 버킷 객체 경로. 화면에서는 signed URL로 열람.';
COMMENT ON COLUMN public.teacher_contracts.signed_pdf_url IS
  '서명 합성 완료 PDF 경로. 선생님·슈퍼관리자 모두 열람.';
COMMENT ON COLUMN public.teacher_contracts.agreed_at IS
  '계약내용 확인 및 전자서명 동의 시각. 서명 완료 시 서버에서 기록.';

ALTER TABLE public.teacher_contracts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_teacher_superadmin()
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

REVOKE ALL ON FUNCTION public.is_teacher_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_superadmin() TO authenticated;

DROP POLICY IF EXISTS "teacher_contracts_select" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_select" ON public.teacher_contracts
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_teacher_superadmin()
  );

DROP POLICY IF EXISTS "teacher_contracts_insert_superadmin" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_insert_superadmin" ON public.teacher_contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_superadmin());

DROP POLICY IF EXISTS "teacher_contracts_update_superadmin" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_update_superadmin" ON public.teacher_contracts
  FOR UPDATE TO authenticated
  USING (public.is_teacher_superadmin() AND status = '서명대기')
  WITH CHECK (public.is_teacher_superadmin() AND status = '서명대기');

DROP POLICY IF EXISTS "teacher_contracts_delete_superadmin" ON public.teacher_contracts;
CREATE POLICY "teacher_contracts_delete_superadmin" ON public.teacher_contracts
  FOR DELETE TO authenticated
  USING (public.is_teacher_superadmin() AND status = '서명대기');

-- 서명완료 계약서는 내용 수정 불가 (Edge Function의 최초 서명 완료 UPDATE 는 OLD.status=서명대기 이므로 허용)
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

DROP TRIGGER IF EXISTS teacher_contracts_lock_signed ON public.teacher_contracts;
CREATE TRIGGER teacher_contracts_lock_signed
  BEFORE UPDATE OR DELETE ON public.teacher_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_teacher_contract_mutation();

GRANT SELECT ON public.teacher_contracts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_contracts TO authenticated;

-- ═══════════════════════════════════════════════
-- 3. Storage (비공개 PDF)
-- 경로: {teacher_id}/{contract_id}/original.pdf | signed.pdf
-- ═══════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-contracts',
  'teacher-contracts',
  false,
  15728640,
  ARRAY['application/pdf', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "teacher_contracts_storage_select" ON storage.objects;
CREATE POLICY "teacher_contracts_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-contracts'
    AND (
      public.is_teacher_superadmin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "teacher_contracts_storage_insert" ON storage.objects;
CREATE POLICY "teacher_contracts_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-contracts'
    AND public.is_teacher_superadmin()
  );

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
