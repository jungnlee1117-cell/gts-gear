-- 비용 영수증 Storage: 본인 업로드 + 관리자 업로드 허용
-- (관리자가 다른 선생님 비용 대리 등록 시 RLS 위반 수정)

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
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = auth.uid()
          AND t.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
      )
    )
  );

DROP POLICY IF EXISTS "expense_receipts_delete_own" ON storage.objects;
CREATE POLICY "expense_receipts_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
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

-- 추가수당·비용 신청: 관리자가 다른 선생님 건 INSERT 가능하도록 WITH CHECK 명시
DROP POLICY IF EXISTS "additional_payment_requests_admin_insert" ON public.additional_payment_requests;
CREATE POLICY "additional_payment_requests_admin_insert"
  ON public.additional_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid()
        AND t.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
    )
  );
