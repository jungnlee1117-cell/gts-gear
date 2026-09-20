-- 선생님 서류(이력서·건강검진표 등)
-- 비공개 Storage + 본인/admin/superadmin만 조회·업로드
-- Supabase SQL Editor 또는: supabase db query --linked -f supabase/teacher_documents.sql

CREATE OR REPLACE FUNCTION public.is_teacher_schedule_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = auth.uid() AND t.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_schedule_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_schedule_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_teacher_documents(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_teacher_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      p_teacher_id = auth.uid()
      OR public.is_teacher_schedule_admin()
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_teacher_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_teacher_documents(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.teacher_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['resume'::text, 'health'::text, 'other'::text])),
  doc_label text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer CHECK (file_size IS NULL OR file_size >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  CONSTRAINT teacher_documents_other_label_chk CHECK (
    doc_type <> 'other'
    OR length(btrim(COALESCE(doc_label, ''))) > 0
  )
);

COMMENT ON TABLE public.teacher_documents IS
  '원에 들어갈 때 쓰는 선생님 서류(이력서·건강검진표 등). 파일은 teacher-documents 비공개 버킷.';
COMMENT ON COLUMN public.teacher_documents.doc_type IS 'resume=이력서, health=건강검진표, other=기타';
COMMENT ON COLUMN public.teacher_documents.doc_label IS '기타일 때 직접 입력한 서류명';
COMMENT ON COLUMN public.teacher_documents.file_path IS 'storage teacher-documents 객체 경로';

CREATE INDEX IF NOT EXISTS teacher_documents_teacher_idx
  ON public.teacher_documents (teacher_id, uploaded_at DESC);

CREATE OR REPLACE FUNCTION public.teacher_documents_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    RAISE EXCEPTION 'teacher_id는 변경할 수 없습니다.';
  END IF;
  IF NEW.doc_type = 'other' THEN
    NEW.doc_label := NULLIF(btrim(COALESCE(NEW.doc_label, '')), '');
  ELSE
    NEW.doc_label := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_documents_protect ON public.teacher_documents;
CREATE TRIGGER teacher_documents_protect
  BEFORE INSERT OR UPDATE ON public.teacher_documents
  FOR EACH ROW EXECUTE FUNCTION public.teacher_documents_protect();

ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.teacher_documents FROM PUBLIC;
REVOKE ALL ON public.teacher_documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_documents TO authenticated;
GRANT ALL ON public.teacher_documents TO service_role;

DROP POLICY IF EXISTS "teacher_documents_select" ON public.teacher_documents;
CREATE POLICY "teacher_documents_select" ON public.teacher_documents
  FOR SELECT TO authenticated
  USING (public.can_access_teacher_documents(teacher_id));

DROP POLICY IF EXISTS "teacher_documents_insert" ON public.teacher_documents;
CREATE POLICY "teacher_documents_insert" ON public.teacher_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_teacher_documents(teacher_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "teacher_documents_update" ON public.teacher_documents;
CREATE POLICY "teacher_documents_update" ON public.teacher_documents
  FOR UPDATE TO authenticated
  USING (public.can_access_teacher_documents(teacher_id))
  WITH CHECK (
    public.can_access_teacher_documents(teacher_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "teacher_documents_delete" ON public.teacher_documents;
CREATE POLICY "teacher_documents_delete" ON public.teacher_documents
  FOR DELETE TO authenticated
  USING (public.can_access_teacher_documents(teacher_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-documents',
  'teacher-documents',
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

DROP POLICY IF EXISTS "teacher_documents_storage_select" ON storage.objects;
CREATE POLICY "teacher_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND public.can_access_teacher_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "teacher_documents_storage_insert" ON storage.objects;
CREATE POLICY "teacher_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-documents'
    AND public.can_access_teacher_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "teacher_documents_storage_update" ON storage.objects;
CREATE POLICY "teacher_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND public.can_access_teacher_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  )
  WITH CHECK (
    bucket_id = 'teacher-documents'
    AND public.can_access_teacher_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "teacher_documents_storage_delete" ON storage.objects;
CREATE POLICY "teacher_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND public.can_access_teacher_documents(
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN ((storage.foldername(name))[1])::uuid
        ELSE NULL
      END
    )
  );

NOTIFY pgrst, 'reload schema';
