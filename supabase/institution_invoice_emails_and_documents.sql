-- 원 세금계산서용 이메일 + 사업자등록증 파일
-- 비공개 Storage + 스케줄 관리자(또는 해당 원 manager_id)만 조회·업로드
-- supabase db query --linked -f supabase/institution_invoice_emails_and_documents.sql

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS invoice_emails text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.institutions.invoice_emails IS
  '세금계산서 발행용 이메일. 보통 1개, 필요 시 여러 개.';

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_invoice_emails_chk;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_invoice_emails_chk
  CHECK (cardinality(invoice_emails) <= 8);

CREATE OR REPLACE FUNCTION public.can_access_institution_documents(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_institution_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      public.is_schedule_admin()
      OR EXISTS (
        SELECT 1
        FROM public.institutions i
        WHERE i.id = p_institution_id
          AND i.manager_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_institution_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_institution_documents(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.institution_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'business_registration'
    CHECK (doc_type = ANY (ARRAY['business_registration'::text])),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer CHECK (file_size IS NULL OR file_size >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.institution_documents IS
  '원 사업자등록증 등. 파일은 institution-documents 비공개 버킷. 교체 시 이전 행을 남겨 이력을 유지.';
COMMENT ON COLUMN public.institution_documents.doc_type IS 'business_registration=사업자등록증';
COMMENT ON COLUMN public.institution_documents.file_path IS 'storage institution-documents 객체 경로';

CREATE INDEX IF NOT EXISTS institution_documents_inst_idx
  ON public.institution_documents (institution_id, doc_type, uploaded_at DESC);

ALTER TABLE public.institution_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.institution_documents FROM PUBLIC;
REVOKE ALL ON public.institution_documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_documents TO authenticated;
GRANT ALL ON public.institution_documents TO service_role;

DROP POLICY IF EXISTS "institution_documents_select" ON public.institution_documents;
CREATE POLICY "institution_documents_select" ON public.institution_documents
  FOR SELECT TO authenticated
  USING (public.can_access_institution_documents(institution_id));

DROP POLICY IF EXISTS "institution_documents_insert" ON public.institution_documents;
CREATE POLICY "institution_documents_insert" ON public.institution_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_institution_documents(institution_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "institution_documents_update" ON public.institution_documents;
CREATE POLICY "institution_documents_update" ON public.institution_documents
  FOR UPDATE TO authenticated
  USING (public.can_access_institution_documents(institution_id))
  WITH CHECK (
    public.can_access_institution_documents(institution_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "institution_documents_delete" ON public.institution_documents;
CREATE POLICY "institution_documents_delete" ON public.institution_documents
  FOR DELETE TO authenticated
  USING (public.can_access_institution_documents(institution_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'institution-documents',
  'institution-documents',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "institution_documents_storage_select" ON storage.objects;
CREATE POLICY "institution_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'institution-documents'
    AND public.can_access_institution_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "institution_documents_storage_insert" ON storage.objects;
CREATE POLICY "institution_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'institution-documents'
    AND public.can_access_institution_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "institution_documents_storage_update" ON storage.objects;
CREATE POLICY "institution_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'institution-documents'
    AND public.can_access_institution_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  )
  WITH CHECK (
    bucket_id = 'institution-documents'
    AND public.can_access_institution_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "institution_documents_storage_delete" ON storage.objects;
CREATE POLICY "institution_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'institution-documents'
    AND public.can_access_institution_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

NOTIFY pgrst, 'reload schema';
