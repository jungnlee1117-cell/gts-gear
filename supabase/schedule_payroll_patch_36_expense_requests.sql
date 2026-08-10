-- 추가수당·비용 신청: 유형 구분 + 영수증 URL + Storage 버킷

ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'allowance';

ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS expense_type text;

ALTER TABLE public.additional_payment_requests
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- 기존 행은 allowance 유지. 새 제약
ALTER TABLE public.additional_payment_requests
  DROP CONSTRAINT IF EXISTS additional_payment_requests_request_kind_check;

ALTER TABLE public.additional_payment_requests
  ADD CONSTRAINT additional_payment_requests_request_kind_check
  CHECK (request_kind = ANY (ARRAY['allowance'::text, 'expense'::text, 'lesson'::text]));

COMMENT ON COLUMN public.additional_payment_requests.request_kind IS
  'allowance=추가수당, expense=비용 환급, lesson=수업(레거시)';
COMMENT ON COLUMN public.additional_payment_requests.expense_type IS
  '식비/자격증/교통비/교육·연수비/소모품 구입/기타';
COMMENT ON COLUMN public.additional_payment_requests.receipt_url IS
  '영수증 사진 public URL (선택)';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 인증 사용자: 본인 폴더에 업로드
-- 비용 영수증 Storage: 본인 업로드 + 관리자 업로드 허용
-- (관리자가 다른 선생님 비용 대리 등록 시 RLS 위반 수정)
-- canonical: schedule_payroll_patch_37_expense_receipt_rls_fix.sql

DROP POLICY IF EXISTS "expense_receipts_upload_own" ON storage.objects;
CREATE POLICY "expense_receipts_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid()
          AND t.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
      )
    )
  );

DROP POLICY IF EXISTS "expense_receipts_update_own" ON storage.objects;
CREATE POLICY "expense_receipts_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "expense_receipts_delete_own" ON storage.objects;
CREATE POLICY "expense_receipts_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 공개 읽기 (public bucket) + 인증 읽기
DROP POLICY IF EXISTS "expense_receipts_public_read" ON storage.objects;
CREATE POLICY "expense_receipts_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'expense-receipts');
